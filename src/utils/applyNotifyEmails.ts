import { HOUSEHOLD_MODE_KEY } from './householdMode';
import { readNotifyRelayConfig, writeNotifyRelayConfig } from './notifyRelayConfig';
import { getHouseholdApiJson } from './householdApiJson';
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
  let coupleMode = false;
  try {
    coupleMode = localStorage.getItem(HOUSEHOLD_MODE_KEY) === 'couple';
  } catch {
    /* ignore */
  }
  const husband = he || base.husbandEmail;
  const wife = we || base.wifeEmail;
  const hasRecipient =
    coupleMode
      ? Boolean(husband.includes('@') && wife.includes('@'))
      : Boolean(husband.includes('@') || wife.includes('@'));
  writeNotifyRelayConfig({
    ...base,
    husbandEmail: husband,
    wifeEmail: wife,
    ...(hasRecipient && !base.enabled ? { enabled: true } : {}),
  });
}

/** Fetch notify emails for the signed-in household and apply to localStorage. */
export async function fetchAndApplyNotifyEmails(): Promise<NotifyEmailsPayload | null> {
  const sess = readHouseholdSession();
  if (!sess?.token || !sess.householdId) return null;
  let j: { notifyEmails?: NotifyEmailsPayload };
  try {
    j = (await getHouseholdApiJson(
      `/v1/household/notify-emails?id=${encodeURIComponent(sess.householdId)}`,
      { auth: 'session' },
    )) as { notifyEmails?: NotifyEmailsPayload };
  } catch {
    return null;
  }
  if (j.notifyEmails) applyNotifyEmails(j.notifyEmails);
  return j.notifyEmails ?? null;
}
