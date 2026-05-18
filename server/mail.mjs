import nodemailer from 'nodemailer';

const notifyTo = process.env.NOTIFY_TO ?? '';

export function splitRecipients(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeRecipientList(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 5) break;
  }
  return out;
}

export function notifyToRecipients() {
  return splitRecipients(notifyTo.trim());
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

export async function sendMail({ to, subject, text, html }) {
  if (process.env.RESEND_API_KEY) return sendWithResend({ to, subject, text, html });
  const transport = createSmtpTransport();
  if (!transport) throw new Error('SMTP_HOST not configured');
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  if (!from) throw new Error('MAIL_FROM or SMTP_USER required for SMTP');
  await transport.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
  return { provider: 'smtp' };
}
