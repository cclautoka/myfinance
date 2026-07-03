import { readSnapshot } from './snapshots.mjs';
import { getDbEnabled, initDbIfNeeded, readState, writeState } from './db.mjs';
import { normalizeRecipientList, notifyToRecipients, sendMail } from './mail.mjs';
import {
  notifyEmailsToRecipientList,
  resolveNotifyEmailsForHousehold,
} from './notifyEmails.mjs';
import {
  computeDailyPushReminderPayload,
  computeDueTodayEmailPayload,
  computeOverdueCadenceEmailPayload,
  patchOverdueReminderSentLog,
  pruneOverdueReminderSentLog,
} from './reminders.mjs';
import { buildReminderEmailTemplate, renderEmailHtml, renderEmailText } from './templates.mjs';
import { glossary } from './copy/glossary.mjs';
import { sendBillReminderPush } from './pushSend.mjs';

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

/**
 * Load workbook for reminders. The Postgres row is authoritative — the filesystem snapshot is a
 * partial reminder cache only and must never replace the full workbook on write.
 */
export async function loadHouseholdReminderState(householdId, log) {
  const id = householdId.trim().slice(0, 64);
  await initDbIfNeeded(log);
  let stateData = null;
  if (getDbEnabled()) {
    const stored = await readState(id).catch(() => null);
    stateData = stored?.state ?? null;
  }
  if (!stateData) {
    const snap = await readSnapshot(id).catch(() => null);
    stateData = snap?.data ?? null;
  }
  return { id, stateData };
}

/**
 * Send due-today + overdue-cadence email; daily push summary unchanged.
 * @returns {{ ok: true, skipped?: boolean, counts?, provider?, to? } | { ok: false, error: string, code?: string }}
 */
export async function sendRemindersForHousehold(householdId, { log, body = {} } = {}) {
  const { id, stateData } = await loadHouseholdReminderState(householdId, log);
  if (!stateData) {
    return { ok: false, error: 'No snapshot or stored state found for id.', code: 'NOT_FOUND' };
  }

  const ref = new Date();
  const pruned = pruneOverdueReminderSentLog(stateData);
  const { monthKey: mk, dueToday } = computeDueTodayEmailPayload(pruned, ref);
  const { overdueCadence } = computeOverdueCadenceEmailPayload(
    pruned,
    ref,
    pruned.billOverdueReminderSentAt,
  );

  const pushPayload = computeDailyPushReminderPayload(pruned, ref);
  const push = await sendBillReminderPush(id, { monthKey: pushPayload.monthKey, counts: pushPayload.counts }, log, pruned);

  const emailCounts = { dueToday: dueToday.length, overdueCadence: overdueCadence.length };
  if (emailCounts.dueToday === 0 && emailCounts.overdueCadence === 0) {
    return { ok: true, skipped: true, counts: { ...pushPayload.counts, ...emailCounts }, householdId: id, push };
  }

  const template = buildReminderEmailTemplate({ monthKey: mk, dueToday, overdueCadence });
  const footerHint =
    emailCounts.overdueCadence > 0
      ? `These bills are past your grace window. Open the app and ${glossary.markAsPaid.toLowerCase()} when paid. ${glossary.workbookOnly}`
      : `Bills due today—${glossary.markAsPaid.toLowerCase()} in the app when paid. ${glossary.workbookOnly}`;
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

  const to = await pickReminderRecipientsAsync(id, body, pruned);
  if (!to.length) {
    if (push.ok && !push.skipped && (push.sent ?? 0) > 0) {
      return { ok: true, pushOnly: true, push, counts: { ...pushPayload.counts, ...emailCounts }, householdId: id };
    }
    return {
      ok: false,
      error:
        'No recipient emails and no push devices. Add emails in Tools or enable app notifications on a phone.',
      code: 'NO_RECIPIENTS',
      householdId: id,
    };
  }

  try {
    const result = await sendMail({ to, subject: template.subject.slice(0, 200), text, html });

    if (overdueCadence.length > 0 && getDbEnabled()) {
      await initDbIfNeeded(log);
      // Patch only the overdue-sent log onto the latest full workbook — never write the partial
      // reminder snapshot back (that wiped incomeLog and other fields after the 7am cron ran).
      const current = await readState(id).catch(() => null);
      const base = current?.state ?? pruned;
      const patched = patchOverdueReminderSentLog(base, overdueCadence, ref);
      await writeState(id, patched).catch((e) => log?.warn?.(e, 'Failed to persist billOverdueReminderSentAt'));
    }

    return {
      ok: true,
      ...result,
      counts: { ...pushPayload.counts, ...emailCounts },
      to,
      householdId: id,
      push,
    };
  } catch (e) {
    log?.error?.(e, 'sendRemindersForHousehold failed');
    return { ok: false, error: 'Failed to send email', code: 'SEND_FAILED', householdId: id };
  }
}
