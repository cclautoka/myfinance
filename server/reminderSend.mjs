import { readSnapshot } from './snapshots.mjs';
import { getDbEnabled, initDbIfNeeded, readState } from './db.mjs';
import { normalizeRecipientList, notifyToRecipients, sendMail } from './mail.mjs';
import {
  notifyEmailsToRecipientList,
  resolveNotifyEmailsForHousehold,
} from './notifyEmails.mjs';
import { computeReminderEmailPayload } from './reminders.mjs';
import {
  buildReminderEmailTemplate,
  renderEmailHtml,
  renderEmailText,
} from './templates.mjs';

/** Reminder recipients: body.to → snapshot → DB member emails → NOTIFY_TO. */
export async function pickReminderRecipientsAsync(householdId, body, stateData) {
  const fromBody = normalizeRecipientList(body?.to);
  if (fromBody.length) return fromBody;
  const fromSnapshot = normalizeRecipientList(stateData?.notifyRecipientEmails);
  if (fromSnapshot.length) return fromSnapshot;
  const notifyEmails = await resolveNotifyEmailsForHousehold(householdId);
  const fromDb = notifyEmailsToRecipientList(notifyEmails);
  if (fromDb.length) return fromDb;
  return notifyToRecipients();
}

export async function loadHouseholdReminderState(householdId, log) {
  const id = householdId.trim().slice(0, 64);
  const snap = await readSnapshot(id).catch(() => null);
  let stateData = snap?.data ?? null;
  if (!stateData) {
    await initDbIfNeeded(log);
    if (getDbEnabled()) {
      const stored = await readState(id).catch(() => null);
      stateData = stored?.state ?? null;
    }
  }
  return { id, stateData };
}

/**
 * Send due/overdue/horizon reminder email for one household.
 * @returns {{ ok: true, skipped?: boolean, counts?, provider?, to? } | { ok: false, error: string, code?: string }}
 */
export async function sendRemindersForHousehold(householdId, { log, body = {} } = {}) {
  const { id, stateData } = await loadHouseholdReminderState(householdId, log);
  if (!stateData) {
    return { ok: false, error: 'No snapshot or stored state found for id.', code: 'NOT_FOUND' };
  }

  const { monthKey: mk, dueSoon, overdue, horizon, counts } = computeReminderEmailPayload(
    stateData,
    new Date(),
  );
  if (counts.dueSoon === 0 && counts.overdue === 0 && counts.horizon === 0) {
    return { ok: true, skipped: true, counts, householdId: id };
  }

  const template = buildReminderEmailTemplate({ monthKey: mk, dueSoon, overdue, horizon });
  const footerHint =
    counts.overdue > 0
      ? 'Overdue items are past your grace window. Open the app and mark handled to keep reminders quiet.'
      : 'Open the app to mark bills paid and keep reminders quiet.';
  const html = renderEmailHtml({
    title: template.title,
    preheader: template.preheader,
    sections: template.sections,
    footerHint,
  });
  const text = renderEmailText({
    title: template.title,
    preheader: template.preheader,
    sections: template.sections,
    footerHint,
  });

  const to = await pickReminderRecipientsAsync(id, body, stateData);
  if (!to.length) {
    return {
      ok: false,
      error:
        'No recipient emails for reminders. Add notification emails in the app or set NOTIFY_TO (legacy).',
      code: 'NO_RECIPIENTS',
      householdId: id,
    };
  }

  try {
    const result = await sendMail({ to, subject: template.subject.slice(0, 200), text, html });
    return { ok: true, ...result, counts, to, householdId: id };
  } catch (e) {
    log?.error?.(e, 'sendRemindersForHousehold failed');
    return { ok: false, error: 'Failed to send email', code: 'SEND_FAILED', householdId: id };
  }
}
