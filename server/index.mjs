import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function sendWithResend({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) throw new Error('RESEND_API_KEY and RESEND_FROM must be set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
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
  await transport.sendMail({ from, to, subject, text });
  return { provider: 'smtp' };
}

async function sendMail({ to, subject, text }) {
  if (process.env.RESEND_API_KEY) return sendWithResend({ to, subject, text });
  return sendWithSmtp({ to, subject, text });
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const serveSpa = fs.existsSync(path.join(publicDir, 'index.html'));

fastify.post('/v1/notify', async (request, reply) => {
  if (!secret || secret.length < 16) {
    return reply.code(503).send({ error: 'NOTIFY_API_SECRET is not set or too short (min 16 chars).' });
  }
  if (!notifyTo) {
    return reply.code(503).send({ error: 'NOTIFY_TO is not set.' });
  }

  const token = parseBearer(request.headers.authorization);
  if (!token || !timingSafeEqual(token, secret)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const body = request.body;
  const summary =
    typeof body?.summary === 'string' && body.summary.trim()
      ? body.summary.trim().slice(0, 8000)
      : '';
  if (!summary) {
    return reply.code(400).send({ error: 'Body must include a non-empty "summary" string.' });
  }

  const subject =
    typeof body?.subject === 'string' && body.subject.trim()
      ? body.subject.trim().slice(0, 200)
      : 'Household finances · update';

  try {
    const result = await sendMail({
      to: notifyTo,
      subject,
      text: summary,
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
