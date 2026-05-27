import { Capacitor } from '@capacitor/core';
import { householdApiFetch } from './householdApiFetch';
import { resolveHouseholdApiBase } from './householdApiBase';
import { getClientPlatform } from './clientPlatform';
import { readHouseholdSession } from './householdSession';
import { readStoredPushToken } from './pushTokenStorage';

export type PushNotificationPrefsDto = {
  billReminders: boolean;
};

export type PushStatus = {
  deviceRegistered: boolean;
  householdDeviceCount: number;
  serverPushConfigured: boolean;
  prefs: PushNotificationPrefsDto;
};

export type PushDeviceRow = {
  id: string;
  platform: 'ios' | 'android';
  memberEmail: string;
  memberRole: string;
  isMine: boolean;
  isThisDevice: boolean;
  updatedAt: string;
};

function authHeaders(): HeadersInit {
  const sess = readHouseholdSession();
  if (!sess?.token) throw new Error('Sign in to manage push notifications.');
  return {
    Authorization: `Bearer ${sess.token}`,
    'Content-Type': 'application/json',
    'X-Client-Platform': getClientPlatform(),
  };
}

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* ignore */
  }
  if (res.status === 401) return 'Session expired — sign in again.';
  if (res.status === 403) return 'Not allowed for this account.';
  return text || `HTTP ${res.status}`;
}

export async function fetchPushStatus(): Promise<PushStatus | null> {
  const sess = readHouseholdSession();
  const base = resolveHouseholdApiBase();
  if (!sess?.token || !sess.householdId || !base) return null;
  const q = new URLSearchParams({ id: sess.householdId });
  const storedToken = readStoredPushToken();
  if (storedToken) q.set('currentToken', storedToken);
  const res = await householdApiFetch(`/v1/household/push/status?${q}`, { headers: authHeaders() });
  if (!res.ok) return null;
  const j = (await res.json()) as PushStatus & { ok?: boolean };
  return {
    deviceRegistered: Boolean(j.deviceRegistered),
    householdDeviceCount: Number(j.householdDeviceCount ?? 0),
    serverPushConfigured: Boolean(j.serverPushConfigured),
    prefs: {
      billReminders: (j.prefs as PushNotificationPrefsDto | undefined)?.billReminders !== false,
    },
  };
}

export async function fetchPushDevices(): Promise<PushDeviceRow[]> {
  const sess = readHouseholdSession();
  const base = resolveHouseholdApiBase();
  if (!sess?.token || !sess.householdId || !base) return [];
  const storedToken = readStoredPushToken();
  const q = new URLSearchParams({ id: sess.householdId });
  if (storedToken) q.set('currentToken', storedToken);
  const res = await householdApiFetch(`/v1/household/push/devices?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = (await res.json()) as { devices?: PushDeviceRow[] };
  return j.devices ?? [];
}

export async function revokePushDevice(deviceId: string): Promise<void> {
  const sess = readHouseholdSession();
  const base = resolveHouseholdApiBase();
  if (!sess?.householdId || !base) throw new Error('API not available.');
  const res = await householdApiFetch(
    `/v1/household/push/devices/revoke?id=${encodeURIComponent(sess.householdId)}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ deviceId }),
    },
  );
  if (!res.ok) throw new Error(await parseApiError(res));
}

export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const sess = readHouseholdSession();
  const base = resolveHouseholdApiBase();
  if (!sess?.householdId || !base) {
    throw new Error('Cannot reach the household API. Check Wi‑Fi and that the app is up to date.');
  }
  const res = await householdApiFetch(`/v1/household/push/register?id=${encodeURIComponent(sess.householdId)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ token, platform }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export async function unregisterPushToken(token?: string): Promise<void> {
  const sess = readHouseholdSession();
  const base = resolveHouseholdApiBase();
  if (!sess?.householdId || !base) return;
  const res = await householdApiFetch(`/v1/household/push/unregister?id=${encodeURIComponent(sess.householdId)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(token ? { token } : {}),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}

function nativePushPlatform(): 'ios' | 'android' | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;
  return Capacitor.getPlatform() === 'android' ? 'android' : 'ios';
}

export async function sendTestPush(): Promise<{ sent?: number; failed?: number }> {
  const sess = readHouseholdSession();
  const base = resolveHouseholdApiBase();
  if (!sess?.householdId || !base) throw new Error('API not available.');
  const platform = nativePushPlatform();
  const body: { currentToken?: string; platform?: 'ios' | 'android' } = {};
  const currentToken = readStoredPushToken();
  if (currentToken) body.currentToken = currentToken;
  if (platform) body.platform = platform;
  const res = await householdApiFetch(`/v1/household/push/test?id=${encodeURIComponent(sess.householdId)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const j = (await res.json()) as { sent?: number; failed?: number };
  return { sent: j.sent, failed: j.failed };
}
