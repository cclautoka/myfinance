import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChangeEmailTemplate, buildReminderEmailTemplate, renderEmailHtml, renderEmailText } from './templates.mjs';
import { readSnapshot, writeSnapshot } from './snapshots.mjs';
import { getDbEnabled, getHouseholdIdFromRequest, initDbIfNeeded, readState, writeState } from './db.mjs';

const port = Number(process.env.PORT ?? 8787);
const secret = process.env.NOTIFY_API_SECRET ?? '';
const notifyTo = process.env.NOTIFY_TO ?? '';

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

function splitRecipients(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendWithResend({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) throw new Error('RESEND_API_KEY and RESEND_FROM must be set');
  const toList = Array.isArray(to) ? to : splitRecipients(to);
  if (toList.length === 0) throw new Error('No recipients configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: toList, subject, text, ...(html ? { html } : {}) }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body}`);
  return { provider: 'resend' };
}

function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASS ?? '' }
        : undefined,
  });
}

async function sendWithSmtp({ to, subject, text }) {
  const transport = createSmtpTransport();
  if (!transport) throw new Error('SMTP_HOST not configured');
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  if (!from) throw new Error('MAIL_FROM or SMTP_USER required for SMTP');
  await transport.sendMail({ from, to, subject, text, html: undefined });
  return { provider: 'smtp' };
}

async function sendMail({ to, subject, text, html }) {
  if (process.env.RESEND_API_KEY) return sendWithResend({ to, subject, text, html });
  const transport = createSmtpTransport();
  if (!transport) throw new Error('SMTP_HOST not configured');
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  if (!from) throw new Error('MAIL_FROM or SMTP_USER required for SMTP');
  await transport.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
  return { provider: 'smtp' };
}

const fastify = Fastify({ logger: true });

const origins = (process.env.NOTIFY_CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (origins.length === 0) return cb(null, true);
    if (!origin) return cb(null, true);
    if (origins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
});

fastify.get('/health', async () => ({ ok: true }));

fastify.get('/v1/state/meta', async (request, reply) => {
  if (!authOr401(request, reply)) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const id = getHouseholdIdFromRequest(request);
  const existing = await readState(id);
  return reply.send({
    ok: true,
    id,
    exists: Boolean(existing),
    updatedAt: existing?.updatedAt ?? null,
  });
});

fastify.get('/v1/state', async (request, reply) => {
  if (!authOr401(request, reply)) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const id = getHouseholdIdFromRequest(request);
  const existing = await readState(id);
  if (!existing) return reply.code(404).send({ error: 'Not found' });
  return reply.send({ ok: true, id, state: existing.state, updatedAt: existing.updatedAt });
});

fastify.put('/v1/state', async (request, reply) => {
  if (!authOr401(request, reply)) return;
  await initDbIfNeeded(request.log);
  if (!getDbEnabled()) return reply.code(503).send({ error: 'DATABASE_URL is not set.' });
  const id = getHouseholdIdFromRequest(request);
  const body = request.body;
  const state = body?.state;
  if (!state || typeof state !== 'object') return reply.code(400).send({ error: 'Body must include "state" object.' });
  const r = await writeState(id, state);
  return reply.send({ ok: true, id, updatedAt: r.updatedAt });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const serveSpa = fs.existsSync(path.join(publicDir, 'index.html'));

function pickRecipients(body) {
  const envTo = splitRecipients(notifyTo.trim());
  const list = Array.isArray(body?.to) ? body.to : [];
  const cleaned = list
    .filter((v) => typeof v === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  return cleaned.length ? cleaned : envTo;
}

function authOr401(request, reply) {
  if (!secret || secret.length < 16) {
    reply.code(503).send({ error: 'NOTIFY_API_SECRET is not set or too short (min 16 chars).' });
    return false;
  }
  const token = parseBearer(request.headers.authorization);
  if (!token || !timingSafeEqual(token, secret)) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

fastify.post('/v1/notify', async (request, reply) => {
  if (!notifyTo) {
    return reply.code(503).send({ error: 'NOTIFY_TO is not set.' });
  }
  if (!authOr401(request, reply)) return;

  const body = request.body;
  const summary =
    typeof body?.summary === 'string' && body.summary.trim()
      ? body.summary.trim().slice(0, 8000)
      : '';
  if (!summary) {
    return reply.code(400).send({ error: 'Body must include a non-empty "summary" string.' });
  }

  const monthKey =
    typeof body?.monthKey === 'string' && body.monthKey.trim() ? body.monthKey.trim().slice(0, 16) : 'this month';
  const pocketLeft = Number.isFinite(Number(body?.pocketLeft)) ? Number(body.pocketLeft) : 0;
  const template = buildChangeEmailTemplate({ summaryText: summary, pocketLeft, monthKey });
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

  try {
    const to = pickRecipients(body);
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

fastify.post('/v1/snapshot', async (request, reply) => {
  if (!authOr401(request, reply)) return;
  const body = request.body;
  const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : '';
  const data = body?.data;
  if (!id) return reply.code(400).send({ error: 'Body must include "id" string.' });
  if (!data || typeof data !== 'object') return reply.code(400).send({ error: 'Body must include "data" object.' });
  await writeSnapshot(id, data);
  return reply.send({ ok: true });
});

/** Manual trigger (or Dokploy Schedule cron) to send due/overdue reminders. */
fastify.post('/v1/reminders/send', async (request, reply) => {
  if (!notifyTo) return reply.code(503).send({ error: 'NOTIFY_TO is not set.' });
  if (!authOr401(request, reply)) return;
  const body = request.body;
  const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 64) : '';
  if (!id) return reply.code(400).send({ error: 'Body must include "id" string.' });
  const snap = await readSnapshot(id).catch(() => null);
  if (!snap?.data) return reply.code(404).send({ error: 'No snapshot found for id.' });

  // Minimal reminder logic (monthly dueDay only): essentials + debts.
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const mk = `${y}-${String(m + 1).padStart(2, '0')}`;
  const today = new Date(y, m, now.getDate());
  const daysLead = Number.isFinite(Number(body?.leadDays)) ? Math.max(0, Math.min(14, Number(body.leadDays))) : 3;
  const leadEdge = new Date(today);
  leadEdge.setDate(leadEdge.getDate() + daysLead);

  const billsPaid = snap.data.billsPaid ?? {};
  const isPaidForMonth = (idKey) => Array.isArray(billsPaid[idKey]) && billsPaid[idKey].includes(mk);

  const asMonthly = (row) =>
    row && typeof row === 'object' && row.dueDay && typeof row.dueDay === 'number'
      ? new Date(y, m, Math.max(1, Math.min(31, row.dueDay)))
      : null;

  const dueSoon = [];
  const overdue = [];

  for (const e of snap.data.essentials ?? []) {
    if (e?.cadence !== 'month') continue;
    const due = asMonthly(e);
    if (!due) continue;
    if (isPaidForMonth(e.id)) continue;
    const rec = { name: e.name ?? e.id, amount: Number(e.amount ?? 0), dueDate: due.toISOString().slice(0, 10) };
    if (due > today && due <= leadEdge) dueSoon.push(rec);
    if (due < today) overdue.push(rec);
  }

  for (const d of snap.data.debts ?? []) {
    const due = asMonthly(d);
    if (!due) continue;
    if (isPaidForMonth(d.id)) continue;
    const rec = { name: d.name ?? d.id, amount: Number(d.monthlyPayment ?? 0), dueDate: due.toISOString().slice(0, 10) };
    if (due > today && due <= leadEdge) dueSoon.push(rec);
    if (due < today) overdue.push(rec);
  }

  const template = buildReminderEmailTemplate({ monthKey: mk, dueSoon, overdue });
  const html = renderEmailHtml({
    title: template.title,
    preheader: template.preheader,
    sections: template.sections,
    footerHint: 'Open the app to mark bills paid and keep reminders quiet.',
  });
  const text = renderEmailText({
    title: template.title,
    preheader: template.preheader,
    sections: template.sections,
  });

  try {
    const to = pickRecipients(body);
    const result = await sendMail({ to, subject: template.subject.slice(0, 200), text, html });
    return reply.send({ ok: true, ...result, counts: { dueSoon: dueSoon.length, overdue: overdue.length } });
  } catch (e) {
    request.log.error(e);
    return reply.code(502).send({ error: 'Failed to send email' });
  }
});

fastify.get('/preview/email', async (request, reply) => {
  const kind = request.query?.kind === 'reminder' ? 'reminder' : 'change';
  const monthKey = '2026-05';
  const tpl =
    kind === 'reminder'
      ? buildReminderEmailTemplate({
          monthKey,
          dueSoon: [
            { name: 'Internet', amount: 114, dueDate: '2026-05-14', note: 'Monthly' },
            { name: 'Rent', amount: 400, dueDate: '2026-05-22', note: 'Monthly' },
          ],
          overdue: [{ name: 'Car loan', amount: 224, dueDate: '2026-05-05', note: 'Auto-deduction' }],
        })
      : buildChangeEmailTemplate({
          summaryText:
            'Income updated (wife schedule biweekly).\nMarked Rent paid for May.\nLogged Husband pay deposit.',
          pocketLeft: 42.75,
          monthKey,
        });

  const html = renderEmailHtml({ title: tpl.title, preheader: tpl.preheader, sections: tpl.sections });
  reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
});

if (serveSpa) {
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });
  fastify.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? '';
    if (url.startsWith('/v1')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
  fastify.log.info('Serving SPA from ./public');
} else {
  fastify.log.warn('No ./public/index.html — API only (local dev?)');
}

try {
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Listening on ${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
