/** localStorage keys for optional Dokploy (or any) notify relay — never stores finance data, only URL + secret. */

/** Same-origin notify endpoint (single Docker service serves UI + API). */
export const DEFAULT_NOTIFY_RELAY_PATH = '/v1/notify';

/** Fixed notify URL for this deployment (optional build override for split-host setups). */
export function resolveNotifyRelayUrl(): string {
  const env =
    typeof import.meta.env.VITE_PUBLIC_NOTIFY_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_NOTIFY_URL.trim()
      : '';
  return env || DEFAULT_NOTIFY_RELAY_PATH;
}

export const NOTIFY_RELAY_ENABLED_KEY = 'finance-notify-relay-enabled';
export const NOTIFY_RELAY_URL_KEY = 'finance-notify-relay-url';
export const NOTIFY_RELAY_SECRET_KEY = 'finance-notify-relay-secret';
export const NOTIFY_RELAY_EMAIL_HUSBAND_KEY = 'finance-notify-relay-email-husband';
export const NOTIFY_RELAY_EMAIL_WIFE_KEY = 'finance-notify-relay-email-wife';
export const NOTIFY_RELAY_HOUSEHOLD_ID_KEY = 'finance-notify-relay-household-id';

export type NotifyRelayConfig = {
  enabled: boolean;
  url: string;
  secret: string;
  husbandEmail: string;
  wifeEmail: string;
  householdId: string;
};

export function readNotifyRelayConfig(): NotifyRelayConfig {
  const url = resolveNotifyRelayUrl();
  try {
    return {
      enabled: localStorage.getItem(NOTIFY_RELAY_ENABLED_KEY) === '1',
      url,
      secret: (localStorage.getItem(NOTIFY_RELAY_SECRET_KEY) ?? '').trim(),
      husbandEmail: (localStorage.getItem(NOTIFY_RELAY_EMAIL_HUSBAND_KEY) ?? '').trim(),
      wifeEmail: (localStorage.getItem(NOTIFY_RELAY_EMAIL_WIFE_KEY) ?? '').trim(),
      householdId: (localStorage.getItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY) ?? '').trim(),
    };
  } catch {
    return { enabled: false, url, secret: '', husbandEmail: '', wifeEmail: '', householdId: '' };
  }
}

export function writeNotifyRelayConfig(c: NotifyRelayConfig): void {
  const url = resolveNotifyRelayUrl();
  try {
    if (c.enabled) localStorage.setItem(NOTIFY_RELAY_ENABLED_KEY, '1');
    else localStorage.removeItem(NOTIFY_RELAY_ENABLED_KEY);
    localStorage.setItem(NOTIFY_RELAY_URL_KEY, url);
    localStorage.setItem(NOTIFY_RELAY_SECRET_KEY, c.secret);
    localStorage.setItem(NOTIFY_RELAY_EMAIL_HUSBAND_KEY, c.husbandEmail.trim());
    localStorage.setItem(NOTIFY_RELAY_EMAIL_WIFE_KEY, c.wifeEmail.trim());
    if (c.householdId.trim()) localStorage.setItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY, c.householdId.trim());
  } catch {
    /* ignore */
  }
}

export function setNotifyRelayHouseholdId(householdId: string): void {
  try {
    const id = householdId.trim();
    if (id) localStorage.setItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY, id);
    else localStorage.removeItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function ensureNotifyRelayHouseholdId(): string {
  try {
    const existing = (localStorage.getItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY) ?? '').trim();
    if (existing) return existing;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY, id);
    return id;
  } catch {
    return '';
  }
}

export function applySetupFromUrlHash(): Partial<NotifyRelayConfig> | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!h.includes('setup=1')) return null;
  const params = new URLSearchParams(h);
  if (params.get('setup') !== '1') return null;
  const hid = (params.get('hid') ?? '').trim();
  const he = (params.get('he') ?? '').trim();
  const we = (params.get('we') ?? '').trim();
  if (!hid) return null;
  if (!/^[a-f0-9]{16,64}$/i.test(hid)) return null;
  return {
    url: resolveNotifyRelayUrl(),
    householdId: decodeURIComponent(hid),
    husbandEmail: decodeURIComponent(he),
    wifeEmail: decodeURIComponent(we),
  };
}

/** Opaque partner-invite token from `#invite=…` (no secrets). */
export function parseInviteTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(h);
  const inv = (params.get('invite') ?? '').trim();
  if (!inv || !/^[a-f0-9]{48}$/i.test(inv)) return null;
  return inv;
}

/** Email verification token from `#verify=…` (64 hex). */
export function parseVerifyTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(h);
  const t = (params.get('verify') ?? '').trim();
  if (!t || !/^[a-f0-9]{64}$/i.test(t)) return null;
  return t;
}

/** Password reset token from `#reset=…` (64 hex). */
export function parseResetTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(h);
  const t = (params.get('reset') ?? '').trim();
  if (!t || !/^[a-f0-9]{64}$/i.test(t)) return null;
  return t;
}

/** Same-origin API root derived from notify relay URL (saved in Tools). */
export function apiBaseFromNotifyUrl(notifyUrl: string): string {
  const u = notifyUrl.trim();
  if (!u) return '';
  if (u.startsWith('/')) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}`;
  }
  if (u.endsWith('/v1/notify')) return u.replace(/\/v1\/notify$/, '');
  return u.replace(/\/$/, '');
}

/** One-time sign-in token from `#login=…` (64 hex). */
export function parseMagicLoginTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(h);
  const t = (params.get('login') ?? '').trim();
  if (!t || !/^[a-f0-9]{64}$/i.test(t)) return null;
  return t;
}

/** POST JSON to the relay without Authorization (public household auth routes). */
export async function postNotifyRelayPublicJson(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { url } = readNotifyRelayConfig();
  const base = apiBaseFromNotifyUrl(url);
  if (!base) throw new Error('API is not available on this host.');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error((j.error as string) || text || `HTTP ${res.status}`);
  return j;
}
