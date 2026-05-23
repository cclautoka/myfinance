import { Capacitor } from '@capacitor/core';
import { apiBaseFromNotifyUrl, readNotifyRelayConfig } from './notifyRelayConfig';

function apiBase(): string {
  return apiBaseFromNotifyUrl(readNotifyRelayConfig().url);
}

/** User-facing message when fetch throws (network / CORS / server down). */
export function formatHouseholdApiError(err: unknown, path: string): string {
  const base = apiBase();
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    const host = base || 'your API server';
    const hint = Capacitor.isNativePlatform()
      ? ' On the phone app, pull to refresh after checking mobile data or Wi‑Fi.'
      : '';
    return `Cannot reach ${host}${path}.${hint} Deploy the latest server or check NOTIFY_CORS / DNS.`;
  }
  return msg;
}

export async function householdApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = apiBase();
  if (!base) throw new Error('API URL is not configured for this build.');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Error(formatHouseholdApiError(err, path));
  }
}
