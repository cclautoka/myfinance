import { Pool } from 'pg';

let pool = null;
let initPromise = null;

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDbEnabled() {
  return hasDb();
}

export function getHouseholdIdFromRequest(request) {
  const q = request?.query ?? {};
  const raw = typeof q.id === 'string' ? q.id.trim() : '';
  const env = (process.env.HOUSEHOLD_ID ?? '').trim();
  return (raw || env || 'default').slice(0, 64);
}

export async function initDbIfNeeded(log) {
  if (!hasDb()) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      create table if not exists finance_state (
        household_id text primary key,
        state jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists household_member (
        id uuid primary key default gen_random_uuid(),
        household_id text not null,
        email text not null,
        password_hash text,
        role text not null check (role in ('owner', 'partner', 'viewer')),
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create unique index if not exists household_member_household_email_lower
        on household_member (household_id, lower(email));
    `);
    await pool.query(`
      create table if not exists household_invite (
        id uuid primary key default gen_random_uuid(),
        token_hash text not null unique,
        household_id text not null,
        inviter_member_id uuid references household_member(id) on delete cascade,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create table if not exists auth_session (
        id uuid primary key default gen_random_uuid(),
        session_token_hash text not null unique,
        household_id text not null,
        member_id uuid not null references household_member(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create index if not exists auth_session_member_idx on auth_session (member_id);
    `);
    await pool.query(`
      create table if not exists household (
        household_id text primary key,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      insert into household (household_id)
      select household_id from finance_state
      on conflict (household_id) do nothing;
    `);
    await pool.query(`
      alter table household_member add column if not exists email_verified_at timestamptz;
    `);
    await pool.query(`
      create table if not exists household_email_token (
        id uuid primary key default gen_random_uuid(),
        member_id uuid not null references household_member(id) on delete cascade,
        token_hash text not null unique,
        kind text not null check (kind in ('verify', 'reset', 'magic_login')),
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      alter table household_email_token drop constraint if exists household_email_token_kind_check;
    `);
    await pool.query(`
      alter table household_email_token add constraint household_email_token_kind_check
        check (kind in ('verify', 'reset', 'magic_login'));
    `);
    await pool.query(`
      create table if not exists household_pairing (
        id uuid primary key default gen_random_uuid(),
        code_hash text not null,
        household_id text not null,
        inviter_member_id uuid not null references household_member(id) on delete cascade,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create index if not exists household_pairing_household_active_idx
        on household_pairing (household_id) where used_at is null;
    `);
    await pool.query(`
      create table if not exists household_bearer_key (
        id uuid primary key default gen_random_uuid(),
        household_id text not null,
        token_hash text not null,
        label text not null default '',
        created_at timestamptz not null default now(),
        revoked_at timestamptz
      );
    `);
    await pool.query(`
      create index if not exists household_bearer_key_household_idx
        on household_bearer_key (household_id) where revoked_at is null;
    `);
    await pool.query(`
      create table if not exists push_device_token (
        id uuid primary key default gen_random_uuid(),
        household_id text not null,
        member_id uuid not null references household_member(id) on delete cascade,
        platform text not null check (platform in ('ios', 'android')),
        token text not null,
        device_name text not null default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create unique index if not exists push_device_token_token_uq on push_device_token (token);
    `);
    await pool.query(`
      create index if not exists push_device_token_household_idx on push_device_token (household_id);
    `);
    await pool.query(`alter table push_device_token add column if not exists device_name text not null default '';`);
    await pool.query(`alter table household_invite add column if not exists partner_email text;`);
    await pool.query(`
      alter table household_invite add column if not exists partner_member_id uuid
        references household_member(id) on delete set null;
    `);
    await pool.query(`alter table household_pairing add column if not exists code_plain text;`);
    await pool.query(`alter table household_invite add column if not exists token_plain text;`);
    await pool.query(`
      create table if not exists household_audit_log (
        id uuid primary key default gen_random_uuid(),
        household_id text not null,
        member_id uuid references household_member(id) on delete set null,
        member_role text not null,
        member_email text not null default '',
        client_platform text not null default 'web',
        summary text not null default '',
        changes jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(`
      create index if not exists household_audit_log_household_created_idx
        on household_audit_log (household_id, created_at desc);
    `);
    log?.info?.('Postgres ready (finance_state + household platform)');
  })();
  return initPromise;
}

export async function listHouseholdIdsWithState() {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(`select household_id from finance_state order by household_id`);
  return r.rows.map((row) => String(row.household_id));
}

export async function tryAdvisoryLock(lockKey) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(`select pg_try_advisory_lock($1::bigint) as locked`, [lockKey]);
  return Boolean(r.rows[0]?.locked);
}

export async function advisoryUnlock(lockKey) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`select pg_advisory_unlock($1::bigint)`, [lockKey]);
}

export async function readState(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    'select state, updated_at from finance_state where household_id = $1',
    [householdId],
  );
  if (!r.rowCount) return null;
  return { state: r.rows[0].state, updatedAt: r.rows[0].updated_at };
}

export async function writeState(householdId, state) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into finance_state (household_id, state, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (household_id)
     do update set state = excluded.state, updated_at = now()
     returning updated_at`,
    [householdId, JSON.stringify(state)],
  );
  await pool.query(
    `insert into household (household_id) values ($1) on conflict (household_id) do nothing`,
    [householdId],
  );
  return { updatedAt: r.rows[0].updated_at };
}

const MAX_AUDIT_CHANGES_BYTES = 48_000;

export async function insertAuditLogEntry({
  householdId,
  memberId,
  memberRole,
  memberEmail,
  clientPlatform,
  summary,
  changes,
}) {
  if (!pool) throw new Error('DB not initialized');
  let changesJson = changes;
  try {
    const raw = JSON.stringify(changes);
    if (raw.length > MAX_AUDIT_CHANGES_BYTES) {
      changesJson = {
        sections: [
          {
            heading: 'What changed',
            body: 'Change detail too large to store; open the app for the full workbook.',
          },
        ],
        truncated: true,
      };
    }
  } catch {
    changesJson = { sections: [], truncated: true };
  }
  const r = await pool.query(
    `insert into household_audit_log
       (household_id, member_id, member_role, member_email, client_platform, summary, changes)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning id, created_at`,
    [
      householdId,
      memberId ?? null,
      memberRole,
      memberEmail ?? '',
      clientPlatform,
      summary ?? '',
      JSON.stringify(changesJson),
    ],
  );
  return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
}

export async function listAuditLogForHousehold(householdId, { limit = 50, before = null } = {}) {
  if (!pool) throw new Error('DB not initialized');
  const lim = Math.min(Math.max(1, Number(limit) || 50), 100);
  const params = [householdId];
  let cursorSql = '';
  if (before) {
    params.push(before);
    cursorSql = `and created_at < $${params.length}::timestamptz`;
  }
  params.push(lim);
  const r = await pool.query(
    `select id, household_id, member_id, member_role, member_email, client_platform, summary, changes, created_at
     from household_audit_log
     where household_id = $1 ${cursorSql}
     order by created_at desc
     limit $${params.length}`,
    params,
  );
  return r.rows.map((row) => ({
    id: row.id,
    householdId: row.household_id,
    memberId: row.member_id,
    memberRole: row.member_role,
    memberEmail: row.member_email,
    clientPlatform: row.client_platform,
    summary: row.summary,
    changes: row.changes,
    createdAt: row.created_at,
  }));
}

/** --- Household auth (additive; no changes to finance_state shape) --- */

export async function findMemberByHouseholdAndEmail(householdId, email) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, email, password_hash, role, email_verified_at from household_member
     where household_id = $1 and lower(email) = lower($2) limit 1`,
    [householdId, email.trim()],
  );
  return r.rows[0] ?? null;
}

/** Lookup by email when household id is unknown (e.g. fresh browser sign-in). */
export async function findMembersByEmail(email) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, email, password_hash, role, email_verified_at from household_member
     where lower(email) = lower($1)`,
    [email.trim()],
  );
  return r.rows;
}

export async function insertHouseholdMember({ householdId, email, passwordHash, role }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_member (household_id, email, password_hash, role, email_verified_at)
     values ($1, $2, $3, $4, null)
     returning id, household_id, email, role, created_at`,
    [householdId, email.trim(), passwordHash, role],
  );
  return r.rows[0];
}

export async function countOwnersForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select count(*)::int as n from household_member where household_id = $1 and role = 'owner'`,
    [householdId],
  );
  return r.rows[0]?.n ?? 0;
}

export async function listMembersForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, email, role, email_verified_at, created_at
     from household_member
     where household_id = $1
     order by created_at asc`,
    [householdId],
  );
  return r.rows;
}

export async function getMemberById(memberId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, email, password_hash, role, email_verified_at from household_member where id = $1`,
    [memberId],
  );
  return r.rows[0] ?? null;
}

export async function insertInvite({
  tokenHash,
  householdId,
  inviterMemberId,
  expiresAt,
  partnerEmail = null,
  partnerMemberId = null,
  tokenPlain = null,
}) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_invite (
       token_hash, household_id, inviter_member_id, expires_at, partner_email, partner_member_id, token_plain
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, token_hash, household_id, expires_at, partner_email, partner_member_id, token_plain`,
    [tokenHash, householdId, inviterMemberId, expiresAt, partnerEmail, partnerMemberId, tokenPlain],
  );
  return r.rows[0];
}

/** Latest unused invite for a partner email (link can be rebuilt from token_plain). */
export async function getLatestUnusedInviteForPartner(householdId, partnerEmail) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, partner_email, partner_member_id, token_plain, expires_at
     from household_invite
     where household_id = $1 and used_at is null and token_plain is not null
       and lower(partner_email) = lower($2)
     order by created_at desc
     limit 1`,
    [householdId, partnerEmail.trim()],
  );
  return r.rows[0] ?? null;
}

export async function getActiveInviteByTokenHash(tokenHash) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, inviter_member_id, expires_at, used_at, partner_email, partner_member_id
     from household_invite
     where token_hash = $1 and used_at is null limit 1`,
    [tokenHash],
  );
  return r.rows[0] ?? null;
}

/** Invite row by token hash (including already-used invites). */
export async function getInviteByTokenHash(tokenHash) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, inviter_member_id, expires_at, used_at, partner_email, partner_member_id
     from household_invite
     where token_hash = $1
     order by created_at desc
     limit 1`,
    [tokenHash],
  );
  return r.rows[0] ?? null;
}

export async function markInviteUsed(inviteId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_invite set used_at = now() where id = $1`, [inviteId]);
}

export async function insertAuthSession({ sessionTokenHash, householdId, memberId, expiresAt }) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `insert into auth_session (session_token_hash, household_id, member_id, expires_at)
     values ($1, $2, $3, $4)`,
    [sessionTokenHash, householdId, memberId, expiresAt],
  );
}

export async function deleteAuthSessionByHash(sessionTokenHash) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`delete from auth_session where session_token_hash = $1`, [sessionTokenHash]);
}

export async function touchAuthSessionExpiry(sessionTokenHash, newExpiresAt) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update auth_session set expires_at = $2 where session_token_hash = $1`, [
    sessionTokenHash,
    newExpiresAt,
  ]);
}

export async function ensureHouseholdRow(householdId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `insert into household (household_id) values ($1) on conflict (household_id) do nothing`,
    [householdId],
  );
}

export async function insertEmailToken({ memberId, tokenHash, kind, expiresAt }) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `insert into household_email_token (member_id, token_hash, kind, expires_at)
     values ($1, $2, $3, $4)`,
    [memberId, tokenHash, kind, expiresAt],
  );
}

export async function deleteUnusedEmailTokens(memberId, kind) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `delete from household_email_token where member_id = $1 and kind = $2 and used_at is null`,
    [memberId, kind],
  );
}

export async function getActiveEmailTokenByHash(tokenHash, kind) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select t.id, t.member_id, t.kind, t.expires_at, t.used_at, m.household_id, m.email, m.role, m.password_hash
     from household_email_token t
     join household_member m on m.id = t.member_id
     where t.token_hash = $1 and t.used_at is null and t.kind = $2 limit 1`,
    [tokenHash, kind],
  );
  return r.rows[0] ?? null;
}

export async function markEmailTokenUsed(tokenId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_email_token set used_at = now() where id = $1`, [tokenId]);
}

export async function markMemberEmailVerified(memberId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_member set email_verified_at = now() where id = $1`, [memberId]);
}

export async function updateMemberPassword(memberId, passwordHash) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_member set password_hash = $2 where id = $1`, [memberId, passwordHash]);
}

export async function insertPairing({ codeHash, householdId, inviterMemberId, expiresAt, codePlain }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_pairing (code_hash, household_id, inviter_member_id, expires_at, code_plain)
     values ($1, $2, $3, $4, $5)
     returning id, code_plain`,
    [codeHash, householdId, inviterMemberId, expiresAt, codePlain ?? null],
  );
  return r.rows[0];
}

export async function getLatestUnusedPairingForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, code_plain, expires_at from household_pairing
     where household_id = $1 and used_at is null and code_plain is not null
     order by created_at desc limit 1`,
    [householdId],
  );
  return r.rows[0] ?? null;
}

/** Current household pairing code (latest row with code_plain — may be used for sign-in). */
export async function getLatestPairingCodeForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, code_plain, code_hash, used_at, expires_at from household_pairing
     where household_id = $1 and code_plain is not null
     order by created_at desc limit 1`,
    [householdId],
  );
  return r.rows[0] ?? null;
}

export async function revokeUnusedPairingsForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `update household_pairing set used_at = now()
     where household_id = $1 and used_at is null`,
    [householdId],
  );
}

export async function getActivePairingByHouseholdAndCodeHash(householdId, codeHash) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, inviter_member_id, expires_at from household_pairing
     where household_id = $1 and code_hash = $2 and used_at is null limit 1`,
    [householdId, codeHash],
  );
  return r.rows[0] ?? null;
}

export async function markPairingUsed(pairingId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`update household_pairing set used_at = now() where id = $1`, [pairingId]);
}

export async function insertBearerKey({ householdId, tokenHash, label }) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `insert into household_bearer_key (household_id, token_hash, label)
     values ($1, $2, $3)
     returning id, created_at`,
    [householdId, tokenHash, label.slice(0, 80)],
  );
  return r.rows[0];
}

export async function listActiveBearerHashesForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select token_hash from household_bearer_key where household_id = $1 and revoked_at is null`,
    [householdId],
  );
  return r.rows.map((row) => row.token_hash);
}

export async function listBearerKeysForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, label, created_at, revoked_at from household_bearer_key where household_id = $1 order by created_at desc`,
    [householdId],
  );
  return r.rows;
}

export async function revokeBearerKey(keyId, householdId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(
    `update household_bearer_key set revoked_at = now() where id = $1 and household_id = $2`,
    [keyId, householdId],
  );
}

/** Tables created by {@link initDbIfNeeded} — used by CLI migrate / smoke checks. */
const CORE_TABLES = [
  'finance_state',
  'household_member',
  'household',
  'household_invite',
  'auth_session',
  'household_email_token',
  'household_pairing',
  'household_bearer_key',
  'push_device_token',
];

export async function upsertPushDeviceToken({ householdId, memberId, platform, token, deviceName }) {
  if (!pool) throw new Error('DB not initialized');
  const plat = platform === 'android' ? 'android' : 'ios';
  const tok = String(token ?? '').trim().slice(0, 4096);
  const name = String(deviceName ?? '').trim().slice(0, 80);
  if (!tok) throw new Error('token required');
  const r = await pool.query(
    `insert into push_device_token (household_id, member_id, platform, token, device_name, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (token) do update set
       household_id = excluded.household_id,
       member_id = excluded.member_id,
       platform = excluded.platform,
       device_name = case when excluded.device_name <> '' then excluded.device_name else push_device_token.device_name end,
       updated_at = now()
     returning id`,
    [householdId, memberId, plat, tok, name],
  );
  return r.rows[0];
}

export async function deletePushDeviceToken(token) {
  if (!pool) throw new Error('DB not initialized');
  const tok = String(token ?? '').trim();
  if (!tok) return;
  await pool.query(`delete from push_device_token where token = $1`, [tok]);
}

export async function deletePushTokensForMember(memberId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`delete from push_device_token where member_id = $1`, [memberId]);
}

export async function listPushTokensForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, member_id, platform, token, updated_at
     from push_device_token where household_id = $1`,
    [householdId],
  );
  return r.rows;
}

export async function countPushTokensForMember(memberId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(`select count(*)::int as n from push_device_token where member_id = $1`, [memberId]);
  return r.rows[0]?.n ?? 0;
}

/** True when this exact FCM/APNs token is saved for the signed-in member. */
export async function memberHasPushToken(memberId, token) {
  if (!pool) throw new Error('DB not initialized');
  const tok = String(token ?? '').trim();
  if (!tok) return false;
  const r = await pool.query(
    `select 1 from push_device_token where member_id = $1 and token = $2 limit 1`,
    [memberId, tok],
  );
  return r.rowCount > 0;
}

export async function listPushDevicesForHousehold(householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select t.id, t.household_id, t.member_id, t.platform, t.token, t.device_name, t.updated_at, m.email as member_email, m.role as member_role
     from push_device_token t
     join household_member m on m.id = t.member_id
     where t.household_id = $1
     order by t.updated_at desc`,
    [householdId],
  );
  return r.rows;
}

export async function getPushDeviceById(deviceId, householdId) {
  if (!pool) throw new Error('DB not initialized');
  const r = await pool.query(
    `select id, household_id, member_id, platform, token, updated_at
     from push_device_token where id = $1 and household_id = $2`,
    [deviceId, householdId],
  );
  return r.rows[0] ?? null;
}

export async function deletePushDeviceById(deviceId, householdId) {
  if (!pool) throw new Error('DB not initialized');
  await pool.query(`delete from push_device_token where id = $1 and household_id = $2`, [deviceId, householdId]);
}

/** Run `initDbIfNeeded` then invoke `fn` with the pg pool (for one-off scripts). */
export async function withDb(fn) {
  await initDbIfNeeded(null);
  if (!pool) throw new Error('DATABASE_URL is not set');
  return fn(pool);
}

/** Returns whether all core tables exist (after migrations / init). */
export async function assertCoreTables(log) {
  await initDbIfNeeded(log);
  if (!pool) {
    return { ok: false, found: [], missing: [...CORE_TABLES], message: 'DATABASE_URL is not set' };
  }
  const r = await pool.query(
    `select tablename from pg_tables where schemaname = 'public' and tablename = any($1::text[])`,
    [CORE_TABLES],
  );
  const found = new Set(r.rows.map((x) => x.tablename));
  const missing = CORE_TABLES.filter((t) => !found.has(t));
  return { ok: missing.length === 0, found: [...found].sort(), missing };
}

