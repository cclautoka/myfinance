const NOTIFY_RELAY_URL_KEY = 'finance-notify-relay-url';
const DEFAULT_NOTIFY_RELAY_PATH = '/v1/notify';

function apiBaseFromNotifyUrl(notifyUrl: string): string {
  const u = notifyUrl.trim();
  if (!u) return '';
  if (u.startsWith('/')) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}`;
  }
  if (u.endsWith('/v1/notify')) return u.replace(/\/v1\/notify$/, '');
  return u.replace(/\/$/, '');
}

function resolveNotifyRelayUrl(): string {
  const env =
    typeof import.meta.env.VITE_PUBLIC_NOTIFY_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_NOTIFY_URL.trim()
      : '';
  return env || DEFAULT_NOTIFY_RELAY_PATH;
}

function readStoredNotifyUrl(): string {
  try {
    return (localStorage.getItem(NOTIFY_RELAY_URL_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

/** API root for fetches — native builds prefer the baked-in absolute URL, not WebView origin. */
export function resolveHouseholdApiBase(): string {
  const envUrl =
    typeof import.meta.env.VITE_PUBLIC_NOTIFY_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_NOTIFY_URL.trim()
      : '';
  const fromEnv = envUrl ? apiBaseFromNotifyUrl(envUrl) : '';
  const fromCfg = apiBaseFromNotifyUrl(readStoredNotifyUrl() || resolveNotifyRelayUrl());
  if (fromCfg.startsWith('http')) return fromCfg;
  if (fromEnv.startsWith('http')) return fromEnv;
  return fromCfg;
}
