import { formatHouseholdApiError, householdApiFetch } from './householdApiFetch';
import { readHouseholdSession } from './householdSession';
import { serverAuthBearer } from './serverAuth';

export type CreateBearerKeyResult =
  | { ok: true; key: string; id: string; createdAt: string }
  | { ok: false; error: string };

/** Dokploy schedule command (runs inside the app container on port 8787). */
export function buildReminderCronCurl(householdId: string, hkKey: string): string {
  const id = householdId.trim();
  const key = hkKey.trim();
  return [
    'curl -sS -X POST "http://127.0.0.1:8787/v1/reminders/send"',
    `-H "Authorization: Bearer ${key}"`,
    '-H "Content-Type: application/json"',
    `-d '{"id":"${id}"}'`,
  ].join(' \\\n  ');
}

/** Multi-household Dokploy shell loop (edit pairs after creating keys per household). */
export function buildMultiHouseholdReminderCronScript(
  pairs: Array<{ householdId: string; hkKey: string }>,
): string {
  const lines = pairs.map(
    (p) => `  "${p.hkKey.trim()}:${p.householdId.trim()}"`,
  );
  return `#!/bin/sh
# Dokploy schedule — daily reminders for all households (Pacific/Fiji cron: 0 7 * * *)
for pair in \\
${lines.join(' \\\n')}; do
  key="\${pair%%:*}"
  hid="\${pair#*:}"
  curl -sS -X POST "http://127.0.0.1:8787/v1/reminders/send" \\
    -H "Authorization: Bearer $key" \\
    -H "Content-Type: application/json" \\
    -d "{\\"id\\":\\"$hid\\"}" || true
done
`;
}

export async function createHouseholdBearerKey(
  householdId: string,
  label = 'dokploy-daily-reminders',
): Promise<CreateBearerKeyResult> {
  const hid = householdId.trim();
  if (!hid) return { ok: false, error: 'No household id.' };

  const sess = readHouseholdSession();
  if (!sess?.token) return { ok: false, error: 'Sign in first.' };
  if (sess.householdId !== hid) {
    return { ok: false, error: 'Household id does not match your signed-in account.' };
  }
  if (sess.role !== 'owner') {
    return { ok: false, error: 'Only the primary owner can create a cron API key.' };
  }

  const bearer = serverAuthBearer();
  if (!bearer) return { ok: false, error: 'Not authorized — sign in again.' };

  let j: Record<string, unknown>;
  try {
    const res = await householdApiFetch('/v1/household/bearer-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ householdId: hid, action: 'create', label }),
    });
    const text = await res.text();
    j = {};
    try {
      j = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      return { ok: false, error: (j.error as string) || text || `HTTP ${res.status}` };
    }
  } catch (e) {
    return { ok: false, error: formatHouseholdApiError(e, '/v1/household/bearer-keys') };
  }

  const key = typeof j.key === 'string' ? j.key : '';
  if (!key.startsWith('hk_')) {
    return { ok: false, error: 'Server did not return a household key.' };
  }

  return {
    ok: true,
    key,
    id: String(j.id ?? ''),
    createdAt: String(j.createdAt ?? ''),
  };
}
