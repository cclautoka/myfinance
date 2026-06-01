import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDueTodayEmailPayload,
  computeOverdueCadenceEmailPayload,
  daysSinceGraceEnded,
  isOverdueCadenceDay,
  patchOverdueReminderSentLog,
} from '../reminders.mjs';

function baseState(overrides = {}) {
  return {
    essentials: [],
    debts: [],
    billsPaid: {},
    billOverdueGraceDays: 2,
    billUpcomingLeadBusinessDays: 3,
    ...overrides,
  };
}

describe('isOverdueCadenceDay', () => {
  it('fires on days 3, 7, 14, 21', () => {
    assert.equal(isOverdueCadenceDay(3), true);
    assert.equal(isOverdueCadenceDay(7), true);
    assert.equal(isOverdueCadenceDay(14), true);
    assert.equal(isOverdueCadenceDay(21), true);
  });

  it('skips day 2, 8, and non-weekly days after 7', () => {
    assert.equal(isOverdueCadenceDay(2), false);
    assert.equal(isOverdueCadenceDay(8), false);
    assert.equal(isOverdueCadenceDay(15), false);
  });
});

describe('computeDueTodayEmailPayload', () => {
  it('includes unpaid bill due on ref day', () => {
    const ref = new Date(2026, 5, 13);
    const state = baseState({
      essentials: [{ id: 'net', name: 'Internet', amount: 114, cadence: 'month', dueDay: 13 }],
    });
    const { dueToday } = computeDueTodayEmailPayload(state, ref);
    assert.equal(dueToday.length, 1);
    assert.equal(dueToday[0].name, 'Internet');
  });

  it('excludes paid bill due today', () => {
    const ref = new Date(2026, 5, 13);
    const state = baseState({
      essentials: [{ id: 'net', name: 'Internet', amount: 114, cadence: 'month', dueDay: 13 }],
      billsPaid: { net: ['2026-06'] },
    });
    const { dueToday } = computeDueTodayEmailPayload(state, ref);
    assert.equal(dueToday.length, 0);
  });
});

describe('computeOverdueCadenceEmailPayload', () => {
  it('includes bill 3 days past grace', () => {
    const due = new Date(2026, 5, 1);
    const ref = new Date(2026, 5, 6);
    assert.equal(daysSinceGraceEnded(ref, due, 2), 3);

    const state = baseState({
      essentials: [{ id: 'net', name: 'Internet', amount: 114, cadence: 'month', dueDay: 1 }],
      billOverdueGraceDays: 2,
    });
    const { overdueCadence } = computeOverdueCadenceEmailPayload(state, ref, {});
    assert.equal(overdueCadence.length, 1);
  });

  it('excludes bill still in grace', () => {
    const ref = new Date(2026, 5, 3);
    const state = baseState({
      essentials: [{ id: 'net', name: 'Internet', amount: 114, cadence: 'month', dueDay: 1 }],
      billOverdueGraceDays: 2,
    });
    const { overdueCadence } = computeOverdueCadenceEmailPayload(state, ref, {});
    assert.equal(overdueCadence.length, 0);
  });

  it('skips when already sent today', () => {
    const ref = new Date(2026, 5, 6);
    const state = baseState({
      essentials: [{ id: 'net', name: 'Internet', amount: 114, cadence: 'month', dueDay: 1 }],
      billOverdueGraceDays: 2,
    });
    const sentLog = { net: { '2026-06': '2026-06-06' } };
    const { overdueCadence } = computeOverdueCadenceEmailPayload(state, ref, sentLog);
    assert.equal(overdueCadence.length, 0);
  });
});

describe('patchOverdueReminderSentLog', () => {
  it('records local day per bill occurrence', () => {
    const ref = new Date(2026, 5, 6);
    const state = baseState();
    const rows = [{ billId: 'net', paymentKey: '2026-06', name: 'Internet', amount: 114, dueDate: '2026-06-01' }];
    const next = patchOverdueReminderSentLog(state, rows, ref);
    assert.equal(next.billOverdueReminderSentAt?.net?.['2026-06'], '2026-06-06');
  });
});
