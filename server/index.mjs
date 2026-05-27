import './load-env.mjs';
import Fastify from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildChangeEmailTemplate,
  buildReminderEmailTemplate,
  buildSaveEmailTemplate,
  buildAuthActionEmail,
  buildPasswordChangedEmail,
  renderEmailHtml,
  renderEmailText,
} from './templates.mjs';
import {
  normalizeRecipientList,
  notifyToRecipients,
  sendMail,
  splitRecipients,
} from './mail.mjs';
import {
  coupleNotifyEmailsFromOwnerSlot,
  resolveNotifyEmailsForHousehold,
} from './notifyEmails.mjs';
import { sendRemindersForHousehold } from './reminderSend.mjs';
import { runDailyRemindersJob, startReminderCronScheduler } from './reminderCron.mjs';
import { readSnapshot, writeSnapshot } from './snapshots.mjs';
import {
  getDbEnabled,
  getHouseholdIdFromRequest,
  initDbIfNeeded,
  readState,
  writeState,
  findMemberByHouseholdAndEmail,
  findMembersByEmail,
  insertHouseholdMember,
  countOwnersForHousehold,
  listMembersForHousehold,
  getMemberById,
  insertInvite,
  getActiveInviteByTokenHash,
  getInviteByTokenHash,
  getLatestUnusedInviteForPartner,
  markInviteUsed,
  ensureHouseholdRow,
  insertEmailToken,
  deleteUnusedEmailTokens,
  getActiveEmailTokenByHash,
  markEmailTokenUsed,
  markMemberEmailVerified,
  updateMemberPassword,
  insertPairing,
  getLatestUnusedPairingForHousehold,
  getLatestPairingCodeForHousehold,
  revokeUnusedPairingsForHousehold,
  getActivePairingByHouseholdAndCodeHash,
  markPairingUsed,
  insertBearerKey,
  listActiveBearerHashesForHousehold,
  listBearerKeysForHousehold,
  revokeBearerKey,
  upsertPushDeviceToken,
  deletePushDeviceToken,
  deletePushTokensForMember,
  countPushTokensForMember,
  memberHasPushToken,
  listPushTokensForHousehold,
  listPushDevicesForHousehold,
  getPushDeviceById,
  deletePushDeviceById,
  insertAuditLogEntry,
  listAuditLogForHousehold,
} from './db.mjs';
import { auditSummaryFromDiff, computeFinanceStateDiff } from './financeStateDiff.mjs';
import { isPushDeliveryConfigured, sendTestPushToMember } from './pushSend.mjs';
import { hashPassword, verifyPassword } from './password.mjs';
import { signFinanceSession, verifyFinanceSession } from './sessionToken.mjs';
import { buildEmptyFinanceState } from './emptyFinanceState.mjs';
import { applyStaticCacheHeaders } from './staticCache.mjs';

const port = Number(process.env.PORT ?? 8787);

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseBearer(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return '';
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : '';
}

async function resolveNotifyRecipients(body, log) {
  const fromBody = normalizeRecipientList(body?.to);
  if (fromBody.length) return fromBody;
  const fromEnv = notifyToRecipients();
  if (fromEnv.length) return fromEnv;
  const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : '';
  if (!id) return [];
  const snap = await readSnapshot(id).catch(() => null);
  let data = snap?.data ?? null;
  if (!data) {
    await initDbIfNeeded(log);
    if (getDbEnabled()) {
      const stored = await readState(id).catch(() => null);
      data = stored?.state ?? null;
    }
  }
  const fromSnapshot = normalizeRecipientList(data?.notifyRecipientEmails);
  if (fromSnapshot.length) return fromSnapshot;
  const notifyEmails = await resolveNotifyEmailsForHousehold(id);
  return normalizeRecipientList(
    [notifyEmails.husbandEmail, notifyEmails.wifeEmail].filter((e) => e.includes('@')),
  );
}

function reminderCronSecret() {
  return (process.env.REMINDER_CRON_SECRET ?? '').trim();
}

async function assertReminderCronAuthorized(request, reply) {
  const secret = reminderCronSecret();
  if (secret.length < 16) {
    reply.code(503).send({ error: 'REMINDER_CRON_SECRET not configured (min 16 chars).' });
    return false;
  }
  const bearer = parseBearer(request.headers.authorization ?? '');
  if (bearer && timingSafeEqual(bearer, secret)) return true;
  reply.code(401).send({ error: 'Unauthorized' });
  return false;
}

const fastify = Fastify({ logger: true });

await fastify.register(compress, {
  global: true,
  encodings: ['br', 'gzip', 'deflate'],
  threshold: 1024,
});

const origins = (process.env.NOTIFY_CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Capacitor WebView origins (when hostname is not set to the API host). */
const NATIVE_APP_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'https://finance.solofi.cloud',
  'http://finance.solofi.cloud',
]);

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (NATIVE_APP_ORIGINS.has(origin)) return cb(null, true);
    if (origins.length === 0) return cb(null, true);
    if (origins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Client-Platform'],
});

fastify.get('/health', async () => ({
  ok: true,
  pushConfigured: isPushDeliveryConfigured(),
}));

function publicAppBase(request) {
  const fromEnv = (process.env.APP_PUBLIC_URL ?? process.env.SITE_URL ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const origin = request?.headers?.origin;
  if (typeof origin === 'string' && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/$/, '');
  }
  const referer = request?.headers?.referer;
  if (typeof referer === 'string') {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function hashUtf8Sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function parseBearerFromRequest(request) {
  return parseBearer(request.headers.authorization ?? '');
}

function isLegacyBearerDisabled() {
  const v = (process.env.NOTIFY_LEGACY_SECRET_DISABLED ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function legacySecret() {
  if (isLegacyBearerDisabled()) return '';
  return (process.env.NOTIFY_API_SECRET ?? '').trim();
}

function sessionSecret() {
  return (process.env.SESSION_SECRET ?? '').trim();
}

async function requirePrimaryOwnerMember(request, reply, householdId, body) {
  await initDbIfNeeded(request.log);
  const bearer = parseBearerFromRequest(request);
  const leg = legacySecret();
  const sess = sessionSecret();

  if (leg.length >= 16 && bearer && timingSafeEqual(bearer, leg)) {
    const ownerEmail = typeof body?.ownerEmail === 'string' ? body.ownerEmail.trim() : '';
    if (!ownerEmail) {
      reply
        .code(403)
        .send({ error: 'With legacy API secret, pass ownerEmail (must match registered primary) to perform this action.' });
      return null;
    }
    const m = await findMemberByHouseholdAndEmail(householdId, ownerEmail);
    if (!m || m.role !== 'owner') {
      reply.code(403).send({ error: 'ownerEmail must match the registered primary owner for this household.' });
      return null;
    }
    return m;
  }

  if (bearer.startsWith('fm_sess_') && sess.length >= 16) {
    const v = verifyFinanceSession(bearer, sess);
    if (!v) {
      reply.code(403).send({ error: 'Invalid session' });
      return null;
    }
    const owner = await getMemberById(v.memberId);
    if (!owner || owner.household_id !== householdId || owner.role !== 'owner') {
      reply.code(403).send({ error: 'Only the primary owner can perform this action.' });
      return null;
    }
    return owner;
  }

  reply.code(403).send({ error: 'Owner session or legacy bearer with ownerEmail required.' });
  return null;
}

function refuseHouseholdApiKey(request, reply) {
  if (parseBearerFromRequest(request).startsWith('hk_')) {
    reply.code(403).send({ error: 'This action requires a signed-in session (not a household API key).' });
    return true;
  }
  return false;
}

function emailVerificationRequired() {
  return String(process.env.EMAIL_VERIFICATION_REQUIRED ?? '').trim() === '1';
}

/** Invite links and pairing codes do not expire — far-future timestamp for DB NOT NULL. */
const NEVER_EXPIRES_AT = '2099-12-31T23:59:59.999Z';

function normalizeEmail(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

function parseOwnerSlot(v) {
  return v === 'wife' ? 'wife' : 'husband';
}

/** Optional partner row + verification email during owner registration (couple households). */
async function registerPartnerAtSignup({ householdId, ownerEmail, partnerEmail, request, log }) {
  const owner = normalizeEmail(ownerEmail);
  const partner = normalizeEmail(partnerEmail);
  if (!partner || !partner.includes('@') || partner === owner) {
    return { partnerVerificationSent: false };
  }
  let partnerMember = await findMemberByHouseholdAndEmail(householdId, partner);
  if (!partnerMember) {
    partnerMember = await insertHouseholdMember({
      householdId,
      email: partner,
      passwordHash: null,
      role: 'partner',
    });
  } else if (partnerMember.role === 'owner') {
    return { partnerVerificationSent: false };
  }
  let partnerVerificationSent = false;
  if (emailVerificationRequired() && !partnerMember.email_verified_at) {
    await deleteUnusedEmailTokens(partnerMember.id, 'verify');
    const verifyRaw = crypto.randomBytes(32).toString('hex');
    const verifyHash = hashUtf8Sha256Hex(verifyRaw);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await insertEmailToken({
      memberId: partnerMember.id,
      tokenHash: verifyHash,
      kind: 'verify',
      expiresAt: expires.toISOString(),
    });
    await sendAuthLinkEmail({
      to: partner,
      hashKey: 'verify',
      rawToken: verifyRaw,
      kind: 'verify',
      request,
    });
    partnerVerificationSent = true;
  }
  return { partnerVerificationSent, partnerEmail: partner };
}

async function persistNotifyEmailsSnapshot(householdId, notifyEmails, log) {
  const husbandEmail = String(notifyEmails?.husbandEmail ?? '').trim();
  const wifeEmail = String(notifyEmails?.wifeEmail ?? '').trim();
  const list = [...new Set([husbandEmail, wifeEmail].filter((e) => e.includes('@')))];
  if (!list.length) return;
  try {
    const existing = await readSnapshot(householdId).catch(() => null);
    const data = existing?.data && typeof existing.data === 'object' ? existing.data : {};
    await writeSnapshot(householdId, {
      ...data,
      notifyRecipientEmails: list,
      notifyEmails: { husbandEmail, wifeEmail },
    });
  } catch (e) {
    log?.warn?.(e, 'Could not write notify emails snapshot');
  }
}

async function sendPartnerInviteEmail({ to, verifyRawToken, inviteRawToken, request }) {
  const base = publicAppBase(request);
  if (!base) {
    throw new Error(
      'APP_PUBLIC_URL or SITE_URL is not set (and request Origin was unavailable). Cannot build email links.',
    );
  }
  const verifyLink = `${base}/#verify=${encodeURIComponent(verifyRawToken)}`;
  const inviteLink = `${base}/#invite=${encodeURIComponent(inviteRawToken)}`;
  const tpl = buildAuthActionEmail({ kind: 'partner_verify', actionLink: verifyLink, inviteLink });
  const html = renderEmailHtml({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
    primaryCta: tpl.primaryCta,
  });
  const text = renderEmailText({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
    primaryCta: tpl.primaryCta,
  });
  await sendMail({ to, subject: tpl.subject.slice(0, 200), text, html });
}

async function sendPartnerJoinEmail({ to, inviteRawToken, pairingCode, request }) {
  const base = publicAppBase(request);
  if (!base) {
    throw new Error(
      'APP_PUBLIC_URL or SITE_URL is not set (and request Origin was unavailable). Cannot build email links.',
    );
  }
  const inviteLink = `${base}/#invite=${encodeURIComponent(inviteRawToken)}`;
  const tpl = buildAuthActionEmail({
    kind: 'partner_join',
    actionLink: inviteLink,
    inviteLink,
    pairingCode,
  });
  const html = renderEmailHtml({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
    primaryCta: tpl.primaryCta,
  });
  const text = renderEmailText({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
    primaryCta: tpl.primaryCta,
  });
  await sendMail({ to, subject: tpl.subject.slice(0, 200), text, html });
}

async function ensurePartnerInviteToken({
  householdId,
  inviterMemberId,
  partnerEmail,
  partnerMemberId,
  regenerate = false,
}) {
  if (!regenerate) {
    const existing = await getLatestUnusedInviteForPartner(householdId, partnerEmail);
    if (existing?.token_plain) return existing.token_plain;
  }
  const raw = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await insertInvite({
    tokenHash,
    householdId,
    inviterMemberId,
    expiresAt: NEVER_EXPIRES_AT,
    partnerEmail,
    partnerMemberId,
    tokenPlain: raw,
  });
  return raw;
}

function sessionTokenTtlSeconds() {
  const days = Number(process.env.SESSION_TOKEN_TTL_DAYS ?? 365);
  const d = Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.floor(days))) : 365;
  return 60 * 60 * 24 * d;
}

async function sendAuthLinkEmail({ to, hashKey, rawToken, kind, request }) {
  const base = publicAppBase(request);
  const frag = `${hashKey}=${encodeURIComponent(rawToken)}`;
  if (!base) {
    throw new Error(
      'APP_PUBLIC_URL or SITE_URL is not set (and request Origin was unavailable). Cannot build email links.',
    );
  }
  const link = `${base}/#${frag}`;
  const tpl = buildAuthActionEmail({ kind, actionLink: link });
  const html = renderEmailHtml({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
    primaryCta: tpl.primaryCta,
  });
  const text = renderEmailText({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
    primaryCta: tpl.primaryCta,
  });
  await sendMail({ to, subject: tpl.subject.slice(0, 200), text, html });
}

/**
 * Legacy global bearer, signed session (`fm_sess_…`), or per-household API key (`hk_…`),
 * scoped to `householdId` for session and household keys.
 */
async function requireSessionMember(request, reply, householdId) {
  const sess = sessionSecret();
  const bearer = parseBearer(request.headers.authorization ?? '');
  if (!bearer.startsWith('fm_sess_') || sess.length < 16) {
    reply.code(401).send({ error: 'Session bearer required' });
    return null;
  }
  const v = verifyFinanceSession(bearer, sess);
  if (!v || v.householdId !== householdId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  await initDbIfNeeded(request.log);
  const member = await getMemberById(v.memberId);
  if (!member || member.household_id !== householdId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  if (emailVerificationRequired() && !member.email_verified_at) {
    reply.code(403).send({ error: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' });
    return null;
  }
  return member;
}

async function assertAuthorized(request, reply, householdId) {
  const leg = legacySecret();
  const sess = sessionSecret();
  const bearer = parseBearer(request.headers.authorization ?? '');

  if (leg.length >= 16 && bearer && timingSafeEqual(bearer, leg)) {
    return true;
  }

  if (bearer.startsWith('fm_sess_') && sess.length >= 16) {
    if (!householdId || typeof householdId !== 'string') {
      reply.code(400).send({ error: 'Include household id for session-authenticated requests.' });
      return false;
    }
    const v = verifyFinanceSession(bearer, sess);
    if (!v || v.householdId !== householdId) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }
    await initDbIfNeeded(request.log);
    const member = await getMemberById(v.memberId);
    if (!member || member.household_id !== householdId) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }
    if (emailVerificationRequired() && !member.email_verified_at) {
      reply.code(403).send({ error: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' });
      return false;
    }
    return true;
  }

  if (bearer.startsWith('hk_')) {
    if (!householdId || typeof householdId !== 'string') {
      reply.code(400).send({ error: 'Include household id for household key requests.' });
      return false;
    }
    await initDbIfNeeded(request.log);
    if (!getDbEnabled()) {
      reply.code(503).send({ error: 'DATABASE_URL is not set.' });
      return false;
    }
    const hashes = await listActiveBearerHashesForHousehold(householdId);
    const digestHex = hashUtf8Sha256Hex(bearer);
    for (const th of hashes) {
      if (digestHex.length === th.length && timingSafeEqual(digestHex, th)) {
        return true;
      }
    }
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }

  if (leg.length >= 16) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  if (sess.length >= 16) {
    reply
      .code(401)
      .send({
        error: isLegacyBearerDisabled()
          ? 'Sign in (fm_sess_…) or use a household hk_… key for this household id.'
          : 'Sign in or set NOTIFY_API_SECRET for legacy device access.',
      });
    return false;
  }
  reply.code(503).send({
    error: isLegacyBearerDisabled()
      ? 'SESSION_SECRET must be set (min 16 chars). NOTIFY_LEGACY_SECRET_DISABLED=1 — legacy NOTIFY_API_SECRET bearer is not accepted.'
      : 'NOTIFY_API_SECRET or SESSION_SECRET must be configured (min 16 chars).',
  });
  return false;
}

function issueSessionToken(memberRow) {
  const sec = sessionSecret();
  if (sec.length < 16) throw new Error('SESSION_SECRET not configured');
  const exp = Math.floor(Date.now() / 1000) + sessionTokenTtlSeconds();
  return signFinanceSession(
    { sub: memberRow.id, hid: memberRow.household_id, role: memberRow.role, exp },
    sec,
  );
}

function parseClientPlatform(header) {
  const raw = typeof header === 'string' ? header.trim().toLowerCase() : '';
  if (raw === 'ios' || raw === 'android' || raw === 'web') return raw;
  return 'web';
}

/** Session member for audit rows (null for legacy secret / hk_ bearer). */
async function resolveSessionMemberForAudit(request, householdId) {
  const sess = sessionSecret();
  const bearer = parseBearer(request.headers.authorization ?? '');
  if (!bearer.startsWith('fm_sess_') || sess.length < 16) return null;
  const v = verifyFinanceSession(bearer, sess);
  if (!v || v.householdId !== householdId) return null;
  await initDbIfNeeded(request.log);
  const member = await getMemberById(v.memberId);
  if (!member || member.household_id !== householdId) return null;
  if (emailVerificationRequired() && !member.email_verified_at) return null;
  return member;
}

fastify.get('/v1/state/meta', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  if (!(await assertAuthorized(request, reply, id))) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const existing = await readState(id);
  return reply.send({
    ok: true,
    id,
    exists: Boolean(existing),
    updatedAt: existing?.updatedAt ?? null,
  });
});

function stateUpdatedAtMs(updatedAt) {
  if (updatedAt == null) return 0;
  const t = Date.parse(updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt));
  return Number.isFinite(t) ? t : 0;
}

/** Long-poll: returns when another client saves (updatedAt advances past `since`). */
fastify.get('/v1/state/watch', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  if (!(await assertAuthorized(request, reply, id))) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });

  const q = request.query ?? {};
  const sinceRaw = typeof q.since === 'string' ? q.since.trim() : '';
  const sinceMs = sinceRaw ? stateUpdatedAtMs(sinceRaw) : 0;
  const waitSec = Math.min(60, Math.max(5, Number(q.wait) || 25));
  const deadline = Date.now() + waitSec * 1000;
  const pollMs = 400;

  while (Date.now() < deadline) {
    const existing = await readState(id);
    if (!existing) {
      return reply.send({ ok: true, id, exists: false, changed: false, updatedAt: null });
    }
    const at = existing.updatedAt;
    if (stateUpdatedAtMs(at) > sinceMs) {
      return reply.send({ ok: true, id, exists: true, changed: true, updatedAt: at });
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const existing = await readState(id);
  return reply.send({
    ok: true,
    id,
    exists: Boolean(existing),
    changed: false,
    updatedAt: existing?.updatedAt ?? null,
  });
});

fastify.get('/v1/state', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  if (!(await assertAuthorized(request, reply, id))) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const existing = await readState(id);
  if (!existing) return reply.code(404).send({ error: 'Not found' });
  return reply.send({ ok: true, id, state: existing.state, updatedAt: existing.updatedAt });
});

fastify.put('/v1/state', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  if (!(await assertAuthorized(request, reply, id))) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const body = request.body;
  const state = body?.state;
  if (!state || typeof state !== 'object') return reply.code(400).send({ error: 'Body must include "state" object.' });
  const previous = await readState(id);
  const baseUpdatedAt =
    typeof body?.baseUpdatedAt === 'string' && body.baseUpdatedAt.trim()
      ? body.baseUpdatedAt.trim()
      : null;
  const force = body?.force === true;
  if (
    !force &&
    previous?.updatedAt &&
    baseUpdatedAt &&
    stateUpdatedAtMs(previous.updatedAt) > stateUpdatedAtMs(baseUpdatedAt)
  ) {
    return reply.code(409).send({
      ok: false,
      error: 'conflict',
      id,
      updatedAt: previous.updatedAt,
      state: previous.state,
    });
  }
  const platform = parseClientPlatform(request.headers['x-client-platform']);
  const r = await writeState(id, state);
  const member = await resolveSessionMemberForAudit(request, id);
  if (member) {
    const from = previous?.state ?? buildEmptyFinanceState();
    const diff = computeFinanceStateDiff(from, state);
    const hasChange =
      diff.sections?.some((s) => (s.items?.length ?? 0) > 0 || Boolean(s.body)) ||
      JSON.stringify(from) !== JSON.stringify(state);
    if (hasChange) {
      try {
        await insertAuditLogEntry({
          householdId: id,
          memberId: member.id,
          memberRole: member.role,
          memberEmail: member.email,
          clientPlatform: platform,
          summary: auditSummaryFromDiff(diff),
          changes: diff,
        });
      } catch (err) {
        request.log.warn({ err }, 'audit log insert failed');
      }
    }
  }
  return reply.send({ ok: true, id, updatedAt: r.updatedAt });
});

fastify.get('/v1/audit', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  if (!(await assertAuthorized(request, reply, id))) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const q = request.query ?? {};
  const limit = typeof q.limit === 'string' ? Number(q.limit) : 50;
  const before = typeof q.before === 'string' && q.before.trim() ? q.before.trim() : null;
  const entries = await listAuditLogForHousehold(id, { limit, before });
  return reply.send({ ok: true, id, entries });
});

/** Public: register first owner for a household (no auth). */
fastify.post('/v1/household/auth/register', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for sign-in tokens.' });
  }
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const householdMode = body.householdMode === 'single' ? 'single' : 'couple';
  const ownerSlot = parseOwnerSlot(body.ownerSlot);
  const partnerEmailRaw = typeof body.partnerEmail === 'string' ? body.partnerEmail.trim() : '';
  if (!householdId || !email || password.length < 8) {
    return reply.code(400).send({ error: 'householdId, email, and password (min 8 chars) required.' });
  }
  if (householdMode === 'couple' && partnerEmailRaw && !partnerEmailRaw.includes('@')) {
    return reply.code(400).send({ error: 'Partner email must be a valid address.' });
  }
  const owners = await countOwnersForHousehold(householdId);
  if (owners > 0) return reply.code(409).send({ error: 'Household already has an owner. Use invite flow for partners.' });
  const existing = await findMemberByHouseholdAndEmail(householdId, email);
  if (existing) return reply.code(409).send({ error: 'Email already registered for this household.' });
  const passwordHash = hashPassword(password);
  let row;
  try {
    row = await insertHouseholdMember({ householdId, email, passwordHash, role: 'owner' });
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ error: 'Could not create account' });
  }
  await ensureHouseholdRow(householdId);
  await writeState(householdId, buildEmptyFinanceState());
  try {
    await deleteUnusedEmailTokens(row.id, 'verify');
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashUtf8Sha256Hex(raw);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await insertEmailToken({
      memberId: row.id,
      tokenHash,
      kind: 'verify',
      expiresAt: expires.toISOString(),
    });
    await sendAuthLinkEmail({ to: row.email, hashKey: 'verify', rawToken: raw, kind: 'verify', request });
  } catch (e) {
    request.log.error(e);
    return reply.code(502).send({
      error: 'Could not send verification email',
      detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
    });
  }

  let partnerVerificationSent = false;
  let savedPartnerEmail = '';
  if (householdMode === 'couple' && partnerEmailRaw) {
    try {
      const pr = await registerPartnerAtSignup({
        householdId,
        ownerEmail: email,
        partnerEmail: partnerEmailRaw,
        request,
        log: request.log,
      });
      partnerVerificationSent = Boolean(pr.partnerVerificationSent);
      savedPartnerEmail = pr.partnerEmail ?? normalizeEmail(partnerEmailRaw);
    } catch (e) {
      request.log.error(e);
    }
  }

  const notifyEmails =
    householdMode === 'couple'
      ? coupleNotifyEmailsFromOwnerSlot(
          ownerSlot,
          email,
          savedPartnerEmail || partnerEmailRaw,
        )
      : { husbandEmail: email.trim(), wifeEmail: '' };
  await persistNotifyEmailsSnapshot(householdId, notifyEmails, request.log);

  return reply.send({
    ok: true,
    needsEmailVerification: true,
    householdMode,
    ownerSlot: householdMode === 'couple' ? ownerSlot : undefined,
    partnerVerificationSent,
    notifyEmails,
    member: {
      id: row.id,
      email: row.email,
      role: row.role,
      householdId,
      emailVerified: false,
    },
  });
});

fastify.post('/v1/household/auth/login', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for sign-in tokens.' });
  }
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return reply.code(400).send({ error: 'email and password required.' });
  }
  let row;
  if (householdId) {
    row = await findMemberByHouseholdAndEmail(householdId, email);
  } else {
    const rows = await findMembersByEmail(email);
    if (rows.length > 1) {
      return reply.code(400).send({ error: 'Multiple accounts found for this email. Contact support.' });
    }
    row = rows[0] ?? null;
  }
  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  const token = issueSessionToken(row);
  const emailVerified = Boolean(row.email_verified_at);
  const notifyEmails = await resolveNotifyEmailsForHousehold(row.household_id);
  return reply.send({
    ok: true,
    token,
    needsEmailVerification: emailVerificationRequired() && !emailVerified,
    notifyEmails,
    member: {
      id: row.id,
      email: row.email,
      role: row.role,
      householdId: row.household_id,
      emailVerified,
    },
  });
});

fastify.get('/v1/household/notify-emails', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  if (!(await assertAuthorized(request, reply, id))) return;
  const notifyEmails = await resolveNotifyEmailsForHousehold(id);
  return reply.send({ ok: true, notifyEmails });
});

fastify.get('/v1/household/auth/me', async (request, reply) => {
  const sess = sessionSecret();
  const bearer = parseBearer(request.headers.authorization ?? '');
  if (!bearer.startsWith('fm_sess_') || sess.length < 16) {
    return reply.code(401).send({ error: 'Session bearer required' });
  }
  const v = verifyFinanceSession(bearer, sess);
  if (!v) return reply.code(401).send({ error: 'Invalid session' });
  await initDbIfNeeded(request.log);
  const member = await getMemberById(v.memberId);
  if (!member) return reply.code(401).send({ error: 'Invalid session' });
  const emailVerified = Boolean(member.email_verified_at);
  if (emailVerificationRequired() && !emailVerified) {
    return reply.code(403).send({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
      member: {
        id: member.id,
        email: member.email,
        role: member.role,
        householdId: member.household_id,
        emailVerified: false,
      },
    });
  }
  const notifyEmails = await resolveNotifyEmailsForHousehold(member.household_id);
  return reply.send({
    ok: true,
    notifyEmails,
    member: {
      id: member.id,
      email: member.email,
      role: member.role,
      householdId: member.household_id,
      emailVerified,
    },
  });
});

fastify.post('/v1/household/auth/refresh', async (request, reply) => {
  const sess = sessionSecret();
  const bearer = parseBearerFromRequest(request);
  if (!bearer.startsWith('fm_sess_') || sess.length < 16) {
    return reply.code(401).send({ error: 'Session bearer required' });
  }
  const v = verifyFinanceSession(bearer, sess);
  if (!v) return reply.code(401).send({ error: 'Invalid session' });
  await initDbIfNeeded(request.log);
  const member = await getMemberById(v.memberId);
  if (!member) return reply.code(401).send({ error: 'Invalid session' });
  const token = issueSessionToken(member);
  return reply.send({
    ok: true,
    token,
    member: {
      id: member.id,
      email: member.email,
      role: member.role,
      householdId: member.household_id,
      emailVerified: Boolean(member.email_verified_at),
    },
  });
});

fastify.post('/v1/household/auth/invite', async (request, reply) => {
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  if (!householdId) return reply.code(400).send({ error: 'householdId required' });
  if (!(await assertAuthorized(request, reply, householdId))) return;
  if (refuseHouseholdApiKey(request, reply)) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });

  const inviter = await requirePrimaryOwnerMember(request, reply, householdId, body);
  if (!inviter) return;

  const partnerEmail = normalizeEmail(body.partnerEmail);
  if (!partnerEmail || !partnerEmail.includes('@')) {
    return reply.code(400).send({ error: 'partnerEmail required (valid email for your partner).' });
  }
  if (normalizeEmail(inviter.email) === partnerEmail) {
    return reply.code(400).send({ error: 'Partner email must be different from the owner email.' });
  }
  const existingPartner = await findMemberByHouseholdAndEmail(householdId, partnerEmail);
  if (existingPartner?.role === 'owner') {
    return reply.code(400).send({ error: 'That email is already the primary owner for this household.' });
  }
  const sendEmail = body.sendEmail === true;
  const regenerate = body.regenerate === true;

  let partnerMember = existingPartner;
  if (!partnerMember) {
    try {
      partnerMember = await insertHouseholdMember({
        householdId,
        email: partnerEmail,
        passwordHash: null,
        role: 'partner',
      });
    } catch (e) {
      request.log.error(e);
      return reply.code(500).send({ error: 'Could not register partner email for invite' });
    }
  }
  if (!emailVerificationRequired()) {
    await markMemberEmailVerified(partnerMember.id);
    partnerMember = await getMemberById(partnerMember.id);
  }

  const token = await ensurePartnerInviteToken({
    householdId,
    inviterMemberId: inviter.id,
    partnerEmail,
    partnerMemberId: partnerMember.id,
    regenerate,
  });

  let verificationEmailSent = false;
  let joinEmailSent = false;
  const partnerEmailVerified = Boolean(partnerMember.email_verified_at);

  if (sendEmail) {
    try {
      if (emailVerificationRequired() && !partnerEmailVerified) {
        await deleteUnusedEmailTokens(partnerMember.id, 'verify');
        const verifyRaw = crypto.randomBytes(32).toString('hex');
        const verifyHash = hashUtf8Sha256Hex(verifyRaw);
        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
        await insertEmailToken({
          memberId: partnerMember.id,
          tokenHash: verifyHash,
          kind: 'verify',
          expiresAt: expires.toISOString(),
        });
        await sendPartnerInviteEmail({
          to: partnerEmail,
          verifyRawToken: verifyRaw,
          inviteRawToken: token,
          request,
        });
        verificationEmailSent = true;
      } else {
        const pairing = await getLatestUnusedPairingForHousehold(householdId);
        await sendPartnerJoinEmail({
          to: partnerEmail,
          inviteRawToken: token,
          pairingCode: pairing?.code_plain ?? '',
          request,
        });
        joinEmailSent = true;
      }
    } catch (e) {
      request.log.error(e);
      return reply.code(502).send({
        error: 'Invite link ready but could not send email',
        detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
        token,
        partnerEmail,
        partnerEmailVerified,
      });
    }
  }

  const base = publicAppBase(request);
  return reply.send({
    ok: true,
    token,
    partnerEmail,
    verificationEmailSent,
    joinEmailSent,
    partnerEmailVerified,
    inviteUrl: base ? `${base}/#invite=${encodeURIComponent(token)}` : null,
    inviteHashFragment: `invite=${encodeURIComponent(token)}`,
  });
});

fastify.post('/v1/household/auth/invite-preview', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const body = request.body ?? {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return reply.code(400).send({ error: 'token required' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let inv = await getActiveInviteByTokenHash(tokenHash);
  let mode = 'join';
  if (!inv) {
    const used = await getInviteByTokenHash(tokenHash);
    if (!used?.used_at) return reply.send({ ok: true, valid: false, reason: 'invalid_or_used' });
    inv = used;
    mode = 'signin';
  }
  const partnerEmail = normalizeEmail(inv.partner_email);
  let member = null;
  if (inv.partner_member_id) member = await getMemberById(inv.partner_member_id);
  else if (partnerEmail) member = await findMemberByHouseholdAndEmail(inv.household_id, partnerEmail);
  if (mode === 'signin') {
    if (!member || member.role !== 'partner') {
      return reply.send({ ok: true, valid: false, reason: 'invalid_or_used' });
    }
    const emailVerified = Boolean(member.email_verified_at) || !emailVerificationRequired();
    return reply.send({
      ok: true,
      valid: true,
      mode: 'signin',
      householdId: inv.household_id,
      partnerEmail: member.email,
      emailVerified,
      needsEmailVerification: emailVerificationRequired() && !emailVerified,
    });
  }
  const emailVerified = Boolean(member?.email_verified_at) || !emailVerificationRequired();
  const needsEmailVerification = emailVerificationRequired() && !emailVerified;
  return reply.send({
    ok: true,
    valid: true,
    mode: 'join',
    householdId: inv.household_id,
    partnerEmail: partnerEmail || member?.email || '',
    emailVerified,
    needsEmailVerification,
    verificationEmailSent: needsEmailVerification,
  });
});

fastify.post('/v1/household/auth/accept-invite', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for partner sessions.' });
  }
  const body = request.body ?? {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return reply.code(400).send({ error: 'token required' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const inv = await getActiveInviteByTokenHash(tokenHash);
  if (!inv) return reply.code(400).send({ error: 'Invalid or used invite' });
  const invitePartnerEmail = normalizeEmail(inv.partner_email);
  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) {
    return reply.code(400).send({ error: 'Partner email required to accept invite' });
  }
  if (invitePartnerEmail && email !== invitePartnerEmail) {
    return reply.code(400).send({
      error: 'Email must match the partner address this invite was sent to.',
      expectedEmail: invitePartnerEmail,
    });
  }
  const codeDigits = String(body.code ?? '').replace(/\D/g, '');
  if (codeDigits.length !== 6) {
    return reply.code(400).send({ error: '6-digit pairing code required' });
  }
  const codeHash = hashUtf8Sha256Hex(`pair:${inv.household_id}:${codeDigits}`);
  const pr = await getActivePairingByHouseholdAndCodeHash(inv.household_id, codeHash);
  if (!pr) return reply.code(400).send({ error: 'Invalid or used pairing code' });

  let row = null;
  if (inv.partner_member_id) row = await getMemberById(inv.partner_member_id);
  if (!row) row = await findMemberByHouseholdAndEmail(inv.household_id, email);
  if (!row) {
    return reply.code(400).send({
      error: 'No partner account for this invite — ask the owner to send a new invite.',
    });
  }
  if (row.role !== 'partner') {
    return reply.code(409).send({ error: 'Already a member' });
  }
  if (normalizeEmail(row.email) !== email) {
    return reply.code(400).send({ error: 'Email does not match this invite.' });
  }
  if (emailVerificationRequired() && !row.email_verified_at) {
    return reply.code(403).send({
      error: 'Verify your email first, then reload this invite page and enter the pairing code.',
      code: 'EMAIL_NOT_VERIFIED',
      partnerEmail: row.email,
    });
  }

  try {
    await markInviteUsed(inv.id);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ error: 'Could not accept invite' });
  }
  await ensureHouseholdRow(inv.household_id);
  const sessionTok = issueSessionToken(row);
  const notifyEmails = await resolveNotifyEmailsForHousehold(inv.household_id);
  return reply.send({
    ok: true,
    token: sessionTok,
    notifyEmails,
    member: {
      id: row.id,
      email: row.email,
      role: row.role,
      householdId: row.household_id,
      emailVerified: Boolean(row.email_verified_at),
    },
  });
});

fastify.post('/v1/household/auth/partner-sign-in', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for partner sessions.' });
  }
  const body = request.body ?? {};
  let householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const email = normalizeEmail(body.email);
  const digits = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (!email || digits.length !== 6) {
    return reply.code(400).send({ error: 'email and 6-digit pairing code required.' });
  }
  let row;
  if (householdId) {
    row = await findMemberByHouseholdAndEmail(householdId, email);
  } else {
    const rows = (await findMembersByEmail(email)).filter((m) => m.role === 'partner');
    if (rows.length > 1) {
      return reply.code(400).send({
        error: 'Multiple partner accounts found for this email. Enter your household id from your partner.',
      });
    }
    row = rows[0] ?? null;
    if (row) householdId = row.household_id;
  }
  if (!row || row.role !== 'partner') {
    return reply.code(401).send({ error: 'No partner account found for this email.' });
  }
  if (emailVerificationRequired() && !row.email_verified_at) {
    return reply.code(403).send({
      error: 'Verify your email first, then sign in with your pairing code.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  const pairing = await getLatestPairingCodeForHousehold(householdId);
  if (!pairing?.code_plain || pairing.code_plain !== digits) {
    return reply.code(401).send({ error: 'Invalid pairing code. Ask your partner for the current code.' });
  }
  const sessionTok = issueSessionToken(row);
  const notifyEmails = await resolveNotifyEmailsForHousehold(householdId);
  return reply.send({
    ok: true,
    token: sessionTok,
    notifyEmails,
    member: {
      id: row.id,
      email: row.email,
      role: row.role,
      householdId: row.household_id,
      emailVerified: Boolean(row.email_verified_at),
    },
  });
});

fastify.post('/v1/household/auth/request-verify-email', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const sess = sessionSecret();
  const bearer = parseBearerFromRequest(request);
  if (!bearer.startsWith('fm_sess_') || sess.length < 16) {
    return reply.code(401).send({ error: 'Sign in required' });
  }
  const v = verifyFinanceSession(bearer, sess);
  if (!v) return reply.code(401).send({ error: 'Invalid session' });
  const member = await getMemberById(v.memberId);
  if (!member) return reply.code(401).send({ error: 'Invalid session' });
  if (member.email_verified_at) {
    return reply.send({ ok: true, message: 'Already verified' });
  }
  try {
    await deleteUnusedEmailTokens(member.id, 'verify');
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashUtf8Sha256Hex(raw);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await insertEmailToken({
      memberId: member.id,
      tokenHash,
      kind: 'verify',
      expiresAt: expires.toISOString(),
    });
    await sendAuthLinkEmail({ to: member.email, hashKey: 'verify', rawToken: raw, kind: 'verify', request });
    return reply.send({ ok: true });
  } catch (e) {
    request.log.error(e);
    return reply.code(502).send({
      error: 'Could not send verification email',
      detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
    });
  }
});

fastify.post('/v1/household/auth/verify-email', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const body = request.body ?? {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return reply.code(400).send({ error: 'token (64 hex chars) required' });
  }
  const tokenHash = hashUtf8Sha256Hex(token);
  const row = await getActiveEmailTokenByHash(tokenHash, 'verify');
  if (!row) return reply.code(400).send({ error: 'Invalid or used token' });
  if (new Date(row.expires_at) < new Date()) return reply.code(400).send({ error: 'Token expired' });
  await markMemberEmailVerified(row.member_id);
  await markEmailTokenUsed(row.id);
  const member = await getMemberById(row.member_id);
  if (!member) return reply.code(500).send({ error: 'Member missing after verify' });
  let sessionToken = null;
  const partnerMustFinishInvite = member.role === 'partner' && emailVerificationRequired();
  if (!partnerMustFinishInvite) {
    try {
      if (sessionSecret().length >= 16) sessionToken = issueSessionToken(member);
    } catch {
      /* ignore */
    }
  }
  return reply.send({
    ok: true,
    verified: true,
    token: sessionToken,
    finishInviteWithPairingCode: partnerMustFinishInvite,
    member: {
      id: member.id,
      email: member.email,
      role: member.role,
      householdId: member.household_id,
      emailVerified: Boolean(member.email_verified_at),
    },
  });
});

fastify.post('/v1/household/auth/request-password-reset', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return reply.code(400).send({ error: 'email required' });
  }
  let row;
  if (householdId) {
    row = await findMemberByHouseholdAndEmail(householdId, email);
  } else {
    const rows = await findMembersByEmail(email);
    if (rows.length > 1) {
      return reply.code(400).send({ error: 'Multiple accounts found for this email. Contact support.' });
    }
    row = rows[0] ?? null;
  }
  const generic = { ok: true };
  if (!row || row.role !== 'owner' || !row.password_hash) {
    return reply.send(generic);
  }
  try {
    await deleteUnusedEmailTokens(row.id, 'reset');
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashUtf8Sha256Hex(raw);
    const expires = new Date(Date.now() + 1000 * 60 * 60);
    await insertEmailToken({
      memberId: row.id,
      tokenHash,
      kind: 'reset',
      expiresAt: expires.toISOString(),
    });
    await sendAuthLinkEmail({ to: row.email, hashKey: 'reset', rawToken: raw, kind: 'reset', request });
  } catch (e) {
    request.log.error(e);
    return reply.code(503).send({
      error: 'Could not send password reset email. Check mail settings (RESEND_* or SMTP_*) and APP_PUBLIC_URL.',
      detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
    });
  }
  return reply.send(generic);
});

fastify.post('/v1/household/auth/reset-password', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const body = request.body ?? {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!token || !/^[a-f0-9]{64}$/i.test(token) || newPassword.length < 8) {
    return reply.code(400).send({ error: 'token (64 hex) and newPassword (min 8 chars) required' });
  }
  const tokenHash = hashUtf8Sha256Hex(token);
  const row = await getActiveEmailTokenByHash(tokenHash, 'reset');
  if (!row || new Date(row.expires_at) < new Date()) {
    return reply.code(400).send({ error: 'Invalid or expired token' });
  }
  await updateMemberPassword(row.member_id, hashPassword(newPassword));
  await markEmailTokenUsed(row.id);

  const member = await getMemberById(row.member_id);
  if (!member?.email) {
    return reply.code(503).send({ error: 'Password updated but confirmation email could not be sent (member not found).' });
  }

  try {
    const tpl = buildPasswordChangedEmail({ appBase: publicAppBase(request) });
    const html = renderEmailHtml({
      title: tpl.title,
      preheader: tpl.preheader,
      sections: tpl.sections,
      footerHint: tpl.footerHint,
      primaryCta: tpl.primaryCta,
    });
    const text = renderEmailText({
      title: tpl.title,
      preheader: tpl.preheader,
      sections: tpl.sections,
      footerHint: tpl.footerHint,
      primaryCta: tpl.primaryCta,
    });
    await sendMail({ to: member.email, subject: tpl.subject.slice(0, 200), text, html });
  } catch (e) {
    request.log.error(e);
    return reply.code(503).send({
      error:
        'Password was updated but the confirmation email could not be sent. Check mail settings (RESEND_* or SMTP_*).',
      detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
    });
  }

  return reply.send({ ok: true });
});

fastify.post('/v1/household/auth/request-magic-login', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for sign-in tokens.' });
  }
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email.includes('@')) {
    return reply.code(400).send({ error: 'valid email required' });
  }
  let row;
  if (householdId) {
    row = await findMemberByHouseholdAndEmail(householdId, email);
  } else {
    const rows = await findMembersByEmail(email);
    if (rows.length > 1) {
      return reply.code(400).send({ error: 'Multiple accounts found for this email. Contact support.' });
    }
    row = rows[0] ?? null;
  }
  const generic = { ok: true };
  if (!row) {
    return reply.send(generic);
  }
  try {
    await deleteUnusedEmailTokens(row.id, 'magic_login');
    const raw = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashUtf8Sha256Hex(raw);
    const expires = new Date(Date.now() + 1000 * 60 * 15);
    await insertEmailToken({
      memberId: row.id,
      tokenHash,
      kind: 'magic_login',
      expiresAt: expires.toISOString(),
    });
    await sendAuthLinkEmail({ to: row.email, hashKey: 'login', rawToken: raw, kind: 'magic', request });
  } catch (e) {
    request.log.error(e);
    return reply.code(503).send({
      error: 'Could not send sign-in link email. Check mail settings and APP_PUBLIC_URL.',
      detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
    });
  }
  return reply.send(generic);
});

fastify.post('/v1/household/auth/consume-magic-login', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for sign-in tokens.' });
  }
  const body = request.body ?? {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return reply.code(400).send({ error: 'token (64 hex chars) required' });
  }
  const tokenHash = hashUtf8Sha256Hex(token);
  const tok = await getActiveEmailTokenByHash(tokenHash, 'magic_login');
  if (!tok) return reply.code(400).send({ error: 'Invalid or used link' });
  if (new Date(tok.expires_at) < new Date()) return reply.code(400).send({ error: 'Link expired' });
  const member = await getMemberById(tok.member_id);
  if (!member) return reply.code(400).send({ error: 'Invalid link' });
  await markEmailTokenUsed(tok.id);
  const sessionTok = issueSessionToken(member);
  return reply.send({
    ok: true,
    token: sessionTok,
    member: {
      id: member.id,
      email: member.email,
      role: member.role,
      householdId: member.household_id,
      emailVerified: Boolean(member.email_verified_at),
    },
  });
});

fastify.post('/v1/household/pairing/create', async (request, reply) => {
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  if (!householdId) return reply.code(400).send({ error: 'householdId required' });
  if (!(await assertAuthorized(request, reply, householdId))) return;
  if (refuseHouseholdApiKey(request, reply)) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const owner = await requirePrimaryOwnerMember(request, reply, householdId, body);
  if (!owner) return;
  const regenerate = body.regenerate === true;
  if (regenerate) {
    await revokeUnusedPairingsForHousehold(householdId);
  } else {
    const existing = await getLatestUnusedPairingForHousehold(householdId);
    if (existing?.code_plain) {
      return reply.send({
        ok: true,
        code: existing.code_plain,
        persistent: true,
        message: 'Reusing your household pairing code (does not expire).',
      });
    }
  }
  const digits = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = hashUtf8Sha256Hex(`pair:${householdId}:${digits}`);
  await insertPairing({
    codeHash,
    householdId,
    inviterMemberId: owner.id,
    expiresAt: NEVER_EXPIRES_AT,
    codePlain: digits,
  });
  return reply.send({
    ok: true,
    code: digits,
    persistent: true,
    message: 'Pairing code created — it does not expire. Share the same code until your partner joins.',
  });
});

fastify.post('/v1/household/pairing/redeem', async (request, reply) => {
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (sessionSecret().length < 16) {
    return reply.code(503).send({ error: 'SESSION_SECRET must be set (min 16 chars) for partner sessions.' });
  }
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const codeDigits = String(body.code ?? '').replace(/\D/g, '');
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!householdId || codeDigits.length !== 6 || !email.includes('@')) {
    return reply.code(400).send({ error: 'householdId, 6-digit code, and email required.' });
  }
  if (password.length > 0 && password.length < 8) {
    return reply.code(400).send({ error: 'Password must be at least 8 characters when provided.' });
  }
  const codeHash = hashUtf8Sha256Hex(`pair:${householdId}:${codeDigits}`);
  const pr = await getActivePairingByHouseholdAndCodeHash(householdId, codeHash);
  if (!pr) return reply.code(400).send({ error: 'Invalid or used pairing code' });
  const existing = await findMemberByHouseholdAndEmail(householdId, email);
  if (existing) return reply.code(409).send({ error: 'Already a member' });
  const passwordHash = password.length >= 8 ? hashPassword(password) : null;
  let row;
  try {
    row = await insertHouseholdMember({
      householdId,
      email,
      passwordHash,
      role: 'partner',
    });
    await markPairingUsed(pr.id);
  } catch (e) {
    request.log.error(e);
    return reply.code(500).send({ error: 'Could not join household' });
  }
  await ensureHouseholdRow(householdId);
  const sessionTok = issueSessionToken(row);
  return reply.send({
    ok: true,
    token: sessionTok,
    member: {
      id: row.id,
      email: row.email,
      role: row.role,
      householdId: row.household_id,
      emailVerified: false,
    },
  });
});

fastify.post('/v1/household/bearer-keys', async (request, reply) => {
  const body = request.body ?? {};
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim().slice(0, 64) : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!householdId) return reply.code(400).send({ error: 'householdId required' });
  if (!action) return reply.code(400).send({ error: 'action required (create | list | revoke)' });
  if (!(await assertAuthorized(request, reply, householdId))) return;
  if (refuseHouseholdApiKey(request, reply)) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const owner = await requirePrimaryOwnerMember(request, reply, householdId, body);
  if (!owner) return;

  if (action === 'create') {
    const raw = `hk_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = hashUtf8Sha256Hex(raw);
    const label = typeof body.label === 'string' ? body.label.slice(0, 80) : '';
    const ins = await insertBearerKey({ householdId, tokenHash, label });
    return reply.send({ ok: true, key: raw, id: ins.id, createdAt: ins.created_at });
  }
  if (action === 'list') {
    const keys = await listBearerKeysForHousehold(householdId);
    return reply.send({
      ok: true,
      keys: keys.map((k) => ({
        id: k.id,
        label: k.label,
        createdAt: k.created_at,
        revoked: Boolean(k.revoked_at),
      })),
    });
  }
  if (action === 'revoke') {
    const keyId = typeof body.keyId === 'string' ? body.keyId.trim() : '';
    if (!keyId) return reply.code(400).send({ error: 'keyId required' });
    await revokeBearerKey(keyId, householdId);
    return reply.send({ ok: true });
  }
  return reply.code(400).send({ error: 'Unknown action' });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const serveSpa = fs.existsSync(path.join(publicDir, 'index.html'));

function sanitizeSaveDigest(body) {
  const d = body?.digest;
  if (!d || typeof d !== 'object' || d.version !== 1) return null;
  const monthKey = typeof d.monthKey === 'string' ? d.monthKey.trim().slice(0, 16) : 'this month';
  const pocketLeft = Number.isFinite(Number(d.pocketLeft)) ? Number(d.pocketLeft) : 0;
  const plannedIncomeCombined = Number.isFinite(Number(d.plannedIncomeCombined))
    ? Number(d.plannedIncomeCombined)
    : 0;
  const sectionsIn = Array.isArray(d.sections) ? d.sections : [];
  const sections = [];
  for (const s of sectionsIn.slice(0, 24)) {
    const heading = typeof s.heading === 'string' ? s.heading.slice(0, 120) : 'Section';
    const bodyT = typeof s.body === 'string' ? s.body.slice(0, 8000) : undefined;
    const itemsIn = Array.isArray(s.items) ? s.items : [];
    const items = [];
    for (const it of itemsIn.slice(0, 35)) {
      items.push({
        title: typeof it.title === 'string' ? it.title.slice(0, 220) : '',
        body: typeof it.body === 'string' ? it.body.slice(0, 500) : undefined,
        meta: typeof it.meta === 'string' ? it.meta.slice(0, 220) : undefined,
      });
    }
    sections.push({ heading, body: bodyT, items: items.length ? items : undefined });
  }
  return { version: 1, monthKey, pocketLeft, plannedIncomeCombined, sections };
}

fastify.post('/v1/notify', async (request, reply) => {
  const body = request.body ?? {};
  const hid =
    typeof body.id === 'string' && body.id.trim()
      ? body.id.trim().slice(0, 64)
      : typeof body.householdId === 'string' && body.householdId.trim()
        ? body.householdId.trim().slice(0, 64)
        : '';
  if (!(await assertAuthorized(request, reply, hid))) return;

  try {
    const rawLen = JSON.stringify(body ?? {}).length;
    if (rawLen > 28000) {
      return reply.code(413).send({ error: 'Payload too large' });
    }
  } catch {
    return reply.code(400).send({ error: 'Invalid JSON body' });
  }

  const digest = sanitizeSaveDigest(body);
  const summary =
    typeof body?.summary === 'string' && body.summary.trim() ? body.summary.trim().slice(0, 8000) : '';

  if (!digest && !summary) {
    return reply
      .code(400)
      .send({ error: 'Body must include a valid "digest" (version: 1) or a non-empty "summary" string.' });
  }

  const digestHasChanges =
    digest &&
    digest.sections?.some(
      (sec) =>
        (sec.items?.length ?? 0) > 0 &&
        sec.heading !== 'This month (cash snapshot)' &&
        !String(sec.heading ?? '').includes('horizon'),
    );
  const isTestSubject = typeof body?.subject === 'string' && body.subject.toLowerCase().includes('test');
  if (digest && !digestHasChanges && !summary && !isTestSubject) {
    return reply.send({ ok: true, skipped: true, reason: 'no_workbook_changes' });
  }

  const monthKey =
    digest?.monthKey ??
    (typeof body?.monthKey === 'string' && body.monthKey.trim() ? body.monthKey.trim().slice(0, 16) : 'this month');
  const pocketLeft = digest
    ? digest.pocketLeft
    : Number.isFinite(Number(body?.pocketLeft))
      ? Number(body.pocketLeft)
      : 0;

  const template = digest
    ? buildSaveEmailTemplate(digest)
    : buildChangeEmailTemplate({ summaryText: summary, pocketLeft, monthKey });
  const html = renderEmailHtml({
    title: template.title,
    preheader: template.preheader,
    sections: template.sections,
  });
  const text = renderEmailText({
    title: template.title,
    preheader: template.preheader,
    sections: template.sections,
  });
  const subject = template.subject.slice(0, 200);

  const to = await resolveNotifyRecipients(body, request.log);
  if (!to.length) {
    return reply.code(400).send({
      error:
        'No recipient emails. Add addresses under Tools & alerts, save (snapshot), or include "to" in the request body. Legacy NOTIFY_TO env is optional.',
    });
  }

  try {
    const result = await sendMail({
      to,
      subject,
      text,
      html,
    });
    return reply.send({ ok: true, ...result });
  } catch (e) {
    request.log.error(e);
    return reply.code(502).send({
      error: 'Failed to send email',
      detail: process.env.NODE_ENV === 'development' ? String(e?.message ?? e) : undefined,
    });
  }
});

function maskEmailForDeviceList(email) {
  const e = String(email ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return 'Unknown';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const shown = local.length <= 2 ? `${local[0] ?? ''}*` : `${local.slice(0, 2)}***`;
  return `${shown}@${domain}`;
}

fastify.get('/v1/household/push/status', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  const member = await requireSessionMember(request, reply, id);
  if (!member) return;
  await initDbIfNeeded(request.log);
  const currentToken = String(request.query?.currentToken ?? '').trim();
  const mine = await countPushTokensForMember(member.id);
  const all = (await listPushTokensForHousehold(id)).length;
  const stored = await readState(id).catch(() => null);
  const prefs = stored?.state?.pushNotificationPrefs ?? { billReminders: true };
  const deviceRegistered = currentToken
    ? await memberHasPushToken(member.id, currentToken)
    : mine > 0;
  return reply.send({
    ok: true,
    deviceRegistered,
    householdDeviceCount: all,
    serverPushConfigured: isPushDeliveryConfigured(),
    prefs: {
      billReminders: prefs?.billReminders !== false,
    },
  });
});

fastify.get('/v1/household/push/devices', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  const member = await requireSessionMember(request, reply, id);
  if (!member) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const currentToken = String(request.query?.currentToken ?? '').trim();
  const rows = await listPushDevicesForHousehold(id);
  return reply.send({
    ok: true,
    devices: rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      memberEmail: maskEmailForDeviceList(r.member_email),
      memberRole: r.member_role,
      isMine: r.member_id === member.id,
      isThisDevice: Boolean(currentToken && r.token === currentToken),
      updatedAt: r.updated_at,
    })),
  });
});

fastify.post('/v1/household/push/devices/revoke', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  const member = await requireSessionMember(request, reply, id);
  if (!member) return;
  const deviceId = String(request.body?.deviceId ?? '').trim();
  if (!deviceId) return reply.code(400).send({ error: 'deviceId required.' });
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const row = await getPushDeviceById(deviceId, id);
  if (!row) return reply.code(404).send({ error: 'Device not found.' });
  const isOwner = member.role === 'owner';
  if (row.member_id !== member.id && !isOwner) {
    return reply.code(403).send({ error: 'You can only remove your own devices unless you are the primary owner.' });
  }
  await deletePushDeviceById(deviceId, id);
  return reply.send({ ok: true });
});

fastify.post('/v1/household/push/register', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  const member = await requireSessionMember(request, reply, id);
  if (!member) return;
  const body = request.body ?? {};
  const token = String(body.token ?? '').trim();
  const platform = String(body.platform ?? '').trim();
  if (token.length < 8) return reply.code(400).send({ error: 'Invalid push token.' });
  if (platform !== 'ios' && platform !== 'android') {
    return reply.code(400).send({ error: 'platform must be ios or android.' });
  }
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  await upsertPushDeviceToken({
    householdId: id,
    memberId: member.id,
    platform,
    token,
  });
  return reply.send({ ok: true });
});

fastify.post('/v1/household/push/unregister', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  const member = await requireSessionMember(request, reply, id);
  if (!member) return;
  const body = request.body ?? {};
  const token = String(body.token ?? '').trim();
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  if (token) await deletePushDeviceToken(token);
  else await deletePushTokensForMember(member.id);
  return reply.send({ ok: true });
});

fastify.post('/v1/household/push/test', async (request, reply) => {
  const id = getHouseholdIdFromRequest(request);
  const member = await requireSessionMember(request, reply, id);
  if (!member) return;
  const body = request.body ?? {};
  const currentToken = String(body.currentToken ?? '').trim();
  const platform = String(body.platform ?? '').trim();
  const result = await sendTestPushToMember(id, member.id, request.log, {
    currentToken,
    platform: platform === 'ios' || platform === 'android' ? platform : undefined,
  });
  if (!result.ok) {
    if (result.code === 'NOT_CONFIGURED') return reply.code(503).send({ error: result.error, code: result.code });
    if (result.code === 'NO_TOKENS') return reply.code(400).send({ error: result.error, code: result.code });
    if (result.code === 'FCM_FAILED') return reply.code(502).send({ error: result.error, code: result.code });
    return reply.code(502).send({ error: result.error });
  }
  return reply.send(result);
});

fastify.post('/v1/snapshot', async (request, reply) => {
  const body = request.body;
  const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : '';
  if (!id) return reply.code(400).send({ error: 'Body must include "id" string.' });
  if (!(await assertAuthorized(request, reply, id))) return;
  const data = body?.data;
  if (!data || typeof data !== 'object') return reply.code(400).send({ error: 'Body must include "data" object.' });
  await writeSnapshot(id, data);
  return reply.send({ ok: true });
});

/** Manual trigger (debug / per-household hk_ key) to send due/overdue reminders. */
fastify.post('/v1/reminders/send', async (request, reply) => {
  const body = request.body ?? {};
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : '';
  if (!id) return reply.code(400).send({ error: 'Body must include "id" string.' });
  if (!(await assertAuthorized(request, reply, id))) return;

  const result = await sendRemindersForHousehold(id, { log: request.log, body });
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return reply.code(404).send({ error: result.error });
    if (result.code === 'NO_RECIPIENTS') return reply.code(400).send({ error: result.error });
    return reply.code(502).send({ error: result.error });
  }
  return reply.send(result);
});

/** Ops trigger: fan-out daily reminders to all households (optional; in-process cron is preferred). */
fastify.post('/v1/reminders/send-all', async (request, reply) => {
  if (!(await assertReminderCronAuthorized(request, reply))) return;
  const summary = await runDailyRemindersJob(request.log);
  return reply.send(summary);
});

fastify.get('/preview/email', async (request, reply) => {
  const q = request.query?.kind;
  const kind =
    q === 'reminder'
      ? 'reminder'
      : q === 'digest'
        ? 'digest'
        : q === 'verify'
          ? 'verify'
          : q === 'reset'
            ? 'reset'
            : q === 'magic'
              ? 'magic'
              : 'change';
  const monthKey = '2026-05';
  let tpl;
  if (kind === 'verify' || kind === 'reset' || kind === 'magic') {
    tpl = buildAuthActionEmail({
      kind: kind === 'magic' ? 'magic' : kind,
      actionLink: 'https://example.com/#verify=demo-token-hex-64-chars-placeholder-demo-token-hex-64-chars',
    });
  } else if (kind === 'reminder') {
    tpl = buildReminderEmailTemplate({
      monthKey,
      dueSoon: [
        { name: 'Internet', amount: 114, dueDate: '2026-05-14', note: 'Essential · Past due (grace)' },
        { name: 'Rent', amount: 400, dueDate: '2026-05-22', note: 'Essential' },
      ],
      overdue: [
        { name: 'Car loan', amount: 224, dueDate: '2026-05-05', note: 'Debt · Auto' },
        { name: 'Power bill', amount: 89, dueDate: '2026-05-13', dueToday: true, note: 'Essential · Due today' },
      ],
      horizon: [{ name: 'Water', amount: 45, dueDate: '2026-05-18', note: 'Essential · Due in ≤14d' }],
    });
  } else if (kind === 'digest') {
    tpl = buildSaveEmailTemplate({
      version: 1,
      monthKey,
      pocketLeft: 188.2,
      plannedIncomeCombined: 3400,
      sections: [
        {
          heading: 'What changed',
          items: [
            { title: 'Income · husbandMonthly', body: '$1,700.00 → $1,750.00' },
            { title: 'Paycheque log added', body: '2026-05-10 · husband · $1,750.00 · Scheduled pay' },
          ],
        },
        {
          heading: 'This month (cash snapshot)',
          items: [
            { title: 'Planned monthly income (combined)', body: '$3,400.00' },
            { title: 'Pocket left (deposits − counted spend)', body: '$188.20', meta: 'Same as dashboard “pocket left so far”.' },
          ],
        },
        {
          heading: 'Due soon (includes grace window)',
          items: [{ title: 'Groceries — $120.00', body: 'Due 2026-05-23', meta: 'Essential' }],
        },
        { heading: 'Overdue', items: [] },
        { heading: 'On the horizon (next 14 days, unpaid)', items: [] },
      ],
    });
  } else {
    tpl = buildChangeEmailTemplate({
      summaryText:
        'Income updated (wife schedule biweekly).\nMarked Rent paid for May.\nLogged Husband pay deposit.',
      pocketLeft: 42.75,
      monthKey,
    });
  }

  const html = renderEmailHtml({
    title: tpl.title,
    preheader: tpl.preheader,
    sections: tpl.sections,
    footerHint: tpl.footerHint,
  });
  reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
});

if (serveSpa) {
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    cacheControl: false,
    setHeaders(res, filePath) {
      applyStaticCacheHeaders(res, filePath);
    },
  });
  fastify.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? '';
    if (url.startsWith('/v1')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    reply.header('Cache-Control', 'no-cache');
    return reply.sendFile('index.html', publicDir);
  });
  fastify.log.info('Serving SPA from ./public');
} else {
  fastify.log.warn('No ./public/index.html — API only (local dev?)');
}

if (getDbEnabled()) {
  try {
    await initDbIfNeeded(fastify.log);
    fastify.log.info('Postgres schema initialized (or already up to date)');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

try {
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Listening on ${port}`);
  fastify.log.info(
    isPushDeliveryConfigured()
      ? 'FCM push delivery: configured (FCM_SERVICE_ACCOUNT_*)'
      : 'FCM push delivery: NOT configured — set FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH',
  );
  startReminderCronScheduler(fastify.log);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
