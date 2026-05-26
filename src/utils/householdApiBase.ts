import { Capacitor } from '@capacitor/core';

const NOTIFY_RELAY_URL_KEY = 'finance-notify-relay-url';
const DEFAULT_NOTIFY_RELAY_PATH = '/v1/notify';

function apiBaseFromNotifyUrl(notifyUrl: string, opts?: { relativeOrigin?: string }): string {
  const u = notifyUrl.trim();
  if (!u) return '';
  if (u.startsWith('/')) {
    const origin = opts?.relativeOrigin?.trim();
    if (!origin) return '';
    return origin;
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

function isCapacitorLocalOrigin(base: string): boolean {
  try {
    const h = new URL(base).hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

/** API root for fetches — native builds must not use WebView localhost as the API host. */
export function resolveHouseholdApiBase(): string {
  const envUrl =
    typeof import.meta.env.VITE_PUBLIC_NOTIFY_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_NOTIFY_URL.trim()
      : '';
  const fromEnv = envUrl ? apiBaseFromNotifyUrl(envUrl) : '';

  const native = Capacitor.isNativePlatform();
  const relativeOrigin =
    native || typeof window === 'undefined' ? '' : window.location.origin;
  const fromCfg = apiBaseFromNotifyUrl(readStoredNotifyUrl() || resolveNotifyRelayUrl(), {
    relativeOrigin,
  });

  const cfgOk = fromCfg.startsWith('http') && !(native && isCapacitorLocalOrigin(fromCfg));
  if (cfgOk) return fromCfg;
  if (fromEnv.startsWith('http')) return fromEnv;
  return cfgOk ? fromCfg : fromEnv || fromCfg;
}
