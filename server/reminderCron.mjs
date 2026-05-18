import { CronJob } from 'cron';
import {
  advisoryUnlock,
  getDbEnabled,
  initDbIfNeeded,
  listHouseholdIdsWithState,
  tryAdvisoryLock,
} from './db.mjs';
import { sendRemindersForHousehold } from './reminderSend.mjs';

/** Stable lock id for daily reminder fan-out (single sender across replicas). */
const REMINDER_CRON_LOCK_KEY = 878701;

function envTruthy(name) {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function isReminderCronEnabled() {
  return envTruthy('REMINDER_CRON_ENABLED');
}

export function reminderCronExpression() {
  return (process.env.REMINDER_CRON_EXPRESSION ?? '0 7 * * *').trim();
}

export function reminderCronTimezone() {
  return (process.env.REMINDER_CRON_TIMEZONE ?? 'Pacific/Fiji').trim();
}

/**
 * Fan out daily reminders to every household with finance_state.
 * @returns {{ ok: true, locked: boolean, households: number, sent: number, skipped: number, errors: number, results: object[] }}
 */
export async function runDailyRemindersJob(log) {
  if (!getDbEnabled()) {
    log?.warn?.('REMINDER_CRON: DATABASE_URL not set — skipping');
    return { ok: true, locked: false, households: 0, sent: 0, skipped: 0, errors: 0, results: [] };
  }

  await initDbIfNeeded(log);
  const locked = await tryAdvisoryLock(REMINDER_CRON_LOCK_KEY);
  if (!locked) {
    log?.info?.('REMINDER_CRON: another instance holds the lock — skipping');
    return { ok: true, locked: false, households: 0, sent: 0, skipped: 0, errors: 0, results: [] };
  }

  const results = [];
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const householdIds = await listHouseholdIdsWithState();
    log?.info?.({ count: householdIds.length }, 'REMINDER_CRON: starting fan-out');

    for (const householdId of householdIds) {
      const r = await sendRemindersForHousehold(householdId, { log });
      results.push(r);
      if (!r.ok) {
        errors += 1;
        log?.warn?.({ householdId, error: r.error, code: r.code }, 'REMINDER_CRON: household failed');
      } else if (r.skipped) {
        skipped += 1;
      } else {
        sent += 1;
      }
    }

    log?.info?.(
      { households: householdIds.length, sent, skipped, errors },
      'REMINDER_CRON: fan-out complete',
    );
    return {
      ok: true,
      locked: true,
      households: householdIds.length,
      sent,
      skipped,
      errors,
      results,
    };
  } finally {
    await advisoryUnlock(REMINDER_CRON_LOCK_KEY).catch((e) => {
      log?.warn?.(e, 'REMINDER_CRON: advisory unlock failed');
    });
  }
}

/** Start in-process daily reminder scheduler (no external Dokploy cron required). */
export function startReminderCronScheduler(log) {
  if (!isReminderCronEnabled()) {
    log?.info?.('REMINDER_CRON_ENABLED is off — in-process daily reminders disabled');
    return null;
  }
  if (!getDbEnabled()) {
    log?.warn?.('REMINDER_CRON_ENABLED but DATABASE_URL missing — scheduler not started');
    return null;
  }

  const expression = reminderCronExpression();
  const timezone = reminderCronTimezone();
  const job = CronJob.from({
    cronTime: expression,
    onTick: () => {
      void runDailyRemindersJob(log).catch((e) => log?.error?.(e, 'REMINDER_CRON: job failed'));
    },
    start: true,
    timeZone: timezone,
  });

  log?.info?.({ expression, timezone }, 'REMINDER_CRON: scheduled in-process daily reminders');
  return job;
}
