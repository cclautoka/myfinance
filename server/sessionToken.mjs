import crypto from 'crypto';

const B64U = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const B64U_DECODE = (s) => {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Buffer.from(t, 'base64');
};

/**
 * Compact signed payload for `fm_sess_…` bearer tokens (no npm jwt dependency).
 * Payload: { sub: memberId, hid: householdId, role, exp } (exp = unix seconds).
 */
export function signFinanceSession(payload, secret) {
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET too short');
  const body = B64U(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = B64U(crypto.createHmac('sha256', secret).update(body).digest());
  return `fm_sess_${body}.${sig}`;
}

export function verifyFinanceSession(token, secret) {
  if (!token || typeof token !== 'string' || !token.startsWith('fm_sess_')) return null;
  const rest = token.slice('fm_sess_'.length);
  const dot = rest.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  const expected = B64U(crypto.createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let parsed;
  try {
    parsed = JSON.parse(B64U_DECODE(body).toString('utf8'));
  } catch {
    return null;
  }
  const exp = Number(parsed?.exp);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  if (typeof parsed.sub !== 'string' || typeof parsed.hid !== 'string') return null;
  return { memberId: parsed.sub, householdId: parsed.hid, role: String(parsed.role ?? 'viewer') };
}
