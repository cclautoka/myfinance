import { apiBaseFromNotifyUrl, readNotifyRelayConfig, writeNotifyRelayConfig } from './notifyRelayConfig';
import { readHouseholdSession } from './householdSession';

export type NotifyEmailsPayload = {
  husbandEmail?: string;
  wifeEmail?: string;
};

/** Merge server husband/wife emails into local notify relay config (non-destructive for filled slots). */
export function applyNotifyEmails(payload: NotifyEmailsPayload | undefined | null): void {
  if (!payload) return;
  const he = (payload.husbandEmail ?? '').trim();
  const we = (payload.wifeEmail ?? '').trim();
  if (!he && !we) return;
  const base = readNotifyRelayConfig();
  writeNotifyRelayConfig({
    ...base,
    husbandEmail: he || base.husbandEmail,
    wifeEmail: we || base.wifeEmail,
  });
}

/** Fetch notify emails for the signed-in household and apply to localStorage. */
export async function fetchAndApplyNotifyEmails(): Promise<NotifyEmailsPayload | null> {
  const sess = readHouseholdSession();
  if (!sess?.token || !sess.householdId) return null;
  const { url } = readNotifyRelayConfig();
  const base = apiBaseFromNotifyUrl(url);
  if (!base) return null;
  const res = await fetch(
    `${base}/v1/household/notify-emails?id=${encodeURIComponent(sess.householdId)}`,
    { headers: { Authorization: `Bearer ${sess.token}` } },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { notifyEmails?: NotifyEmailsPayload };
  if (j.notifyEmails) applyNotifyEmails(j.notifyEmails);
  return j.notifyEmails ?? null;
}
