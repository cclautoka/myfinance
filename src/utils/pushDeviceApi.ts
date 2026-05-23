import { householdApiFetch } from './householdApiFetch';
import { apiBaseFromNotifyUrl, readNotifyRelayConfig } from './notifyRelayConfig';
import { readHouseholdSession } from './householdSession';

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

function apiBase(): string {
  const { url } = readNotifyRelayConfig();
  return apiBaseFromNotifyUrl(url);
}

function authHeaders(): HeadersInit {
  const sess = readHouseholdSession();
  if (!sess?.token) throw new Error('Sign in to manage push notifications.');
  return { Authorization: `Bearer ${sess.token}`, 'Content-Type': 'application/json' };
}

export async function fetchPushStatus(): Promise<PushStatus | null> {
  const sess = readHouseholdSession();
  const base = apiBase();
  if (!sess?.token || !sess.householdId || !base) return null;
  const res = await householdApiFetch(
    `/v1/household/push/status?id=${encodeURIComponent(sess.householdId)}`,
    { headers: authHeaders() },
  );
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
  const base = apiBase();
  if (!sess?.token || !sess.householdId || !base) return [];
  const storedToken = (() => {
    try {
      return (localStorage.getItem('finance-push-device-token') ?? '').trim();
    } catch {
      return '';
    }
  })();
  const q = new URLSearchParams({ id: sess.householdId });
  if (storedToken) q.set('currentToken', storedToken);
  const res = await householdApiFetch(`/v1/household/push/devices?${q}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = (await res.json()) as { devices?: PushDeviceRow[] };
  return j.devices ?? [];
}

export async function revokePushDevice(deviceId: string): Promise<void> {
  const sess = readHouseholdSession();
  const base = apiBase();
  if (!sess?.householdId || !base) throw new Error('API not available.');
  const res = await householdApiFetch(
    `/v1/household/push/devices/revoke?id=${encodeURIComponent(sess.householdId)}`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ deviceId }),
    },
  );
  const text = await res.text();
  let j: { error?: string } = {};
  try {
    j = JSON.parse(text) as { error?: string };
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(j.error || text || `HTTP ${res.status}`);
}

export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const sess = readHouseholdSession();
  const base = apiBase();
  if (!sess?.householdId || !base) throw new Error('API not available.');
  const res = await householdApiFetch(`/v1/household/push/register?id=${encodeURIComponent(sess.householdId)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ token, platform }),
  });
  const text = await res.text();
  let j: { error?: string } = {};
  try {
    j = JSON.parse(text) as { error?: string };
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(j.error || text || `HTTP ${res.status}`);
}

export async function unregisterPushToken(token?: string): Promise<void> {
  const sess = readHouseholdSession();
  const base = apiBase();
  if (!sess?.householdId || !base) return;
  const res = await householdApiFetch(`/v1/household/push/unregister?id=${encodeURIComponent(sess.householdId)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(token ? { token } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export async function sendTestPush(): Promise<{ sent?: number; failed?: number }> {
  const sess = readHouseholdSession();
  const base = apiBase();
  if (!sess?.householdId || !base) throw new Error('API not available.');
  const res = await householdApiFetch(`/v1/household/push/test?id=${encodeURIComponent(sess.householdId)}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const text = await res.text();
  let j: { error?: string; sent?: number; failed?: number } = {};
  try {
    j = JSON.parse(text) as typeof j;
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(j.error || text || `HTTP ${res.status}`);
  return { sent: j.sent, failed: j.failed };
}
