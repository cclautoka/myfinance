import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isReminderCronEnabled, runDailyRemindersJob } from '../reminderCron.mjs';

describe('isReminderCronEnabled', () => {
  const prev = process.env.REMINDER_CRON_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.REMINDER_CRON_ENABLED;
    else process.env.REMINDER_CRON_ENABLED = prev;
  });

  it('is true for 1', () => {
    process.env.REMINDER_CRON_ENABLED = '1';
    assert.equal(isReminderCronEnabled(), true);
  });

  it('is false when unset', () => {
    delete process.env.REMINDER_CRON_ENABLED;
    assert.equal(isReminderCronEnabled(), false);
  });
});

describe('runDailyRemindersJob', () => {
  const prevDb = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it('returns empty summary when DATABASE_URL is not set', async () => {
    const summary = await runDailyRemindersJob(null);
    assert.equal(summary.ok, true);
    assert.equal(summary.households, 0);
    assert.equal(summary.locked, false);
  });
});
