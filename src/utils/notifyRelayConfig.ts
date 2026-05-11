/** localStorage keys for optional Dokploy (or any) notify relay — never stores finance data, only URL + secret. */

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
  try {
    return {
      enabled: localStorage.getItem(NOTIFY_RELAY_ENABLED_KEY) === '1',
      url: (localStorage.getItem(NOTIFY_RELAY_URL_KEY) ?? '').trim(),
      secret: (localStorage.getItem(NOTIFY_RELAY_SECRET_KEY) ?? '').trim(),
      husbandEmail: (localStorage.getItem(NOTIFY_RELAY_EMAIL_HUSBAND_KEY) ?? '').trim(),
      wifeEmail: (localStorage.getItem(NOTIFY_RELAY_EMAIL_WIFE_KEY) ?? '').trim(),
      householdId: (localStorage.getItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY) ?? '').trim(),
    };
  } catch {
    return { enabled: false, url: '', secret: '', husbandEmail: '', wifeEmail: '', householdId: '' };
  }
}

export function writeNotifyRelayConfig(c: NotifyRelayConfig): void {
  try {
    if (c.enabled) localStorage.setItem(NOTIFY_RELAY_ENABLED_KEY, '1');
    else localStorage.removeItem(NOTIFY_RELAY_ENABLED_KEY);
    localStorage.setItem(NOTIFY_RELAY_URL_KEY, c.url.trim());
    localStorage.setItem(NOTIFY_RELAY_SECRET_KEY, c.secret);
    localStorage.setItem(NOTIFY_RELAY_EMAIL_HUSBAND_KEY, c.husbandEmail.trim());
    localStorage.setItem(NOTIFY_RELAY_EMAIL_WIFE_KEY, c.wifeEmail.trim());
    if (c.householdId.trim()) localStorage.setItem(NOTIFY_RELAY_HOUSEHOLD_ID_KEY, c.householdId.trim());
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

export function buildShareSetupLink(input: {
  baseUrl: string;
  notifyUrl: string;
  householdId: string;
  husbandEmail?: string;
  wifeEmail?: string;
}): string {
  const { baseUrl, notifyUrl, householdId, husbandEmail, wifeEmail } = input;
  const u = new URL(baseUrl);
  // Never include secrets in links. Emails are okay to include.
  const he = (husbandEmail ?? '').trim();
  const we = (wifeEmail ?? '').trim();
  const emailPart =
    he || we ? `&he=${encodeURIComponent(he)}&we=${encodeURIComponent(we)}` : '';
  u.hash = `setup=1&notify=${encodeURIComponent(notifyUrl)}&hid=${encodeURIComponent(householdId)}${emailPart}`;
  return u.toString();
}

export function applySetupFromUrlHash(): Partial<NotifyRelayConfig> | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!h.includes('setup=1')) return null;
  const params = new URLSearchParams(h);
  if (params.get('setup') !== '1') return null;
  const notify = (params.get('notify') ?? '').trim();
  const hid = (params.get('hid') ?? '').trim();
  const he = (params.get('he') ?? '').trim();
  const we = (params.get('we') ?? '').trim();
  if (!notify || !hid) return null;
  if (!/^[a-f0-9]{16,64}$/i.test(hid)) return null;
  return {
    url: decodeURIComponent(notify),
    householdId: decodeURIComponent(hid),
    husbandEmail: decodeURIComponent(he),
    wifeEmail: decodeURIComponent(we),
  };
}
