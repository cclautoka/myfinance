import { describe, expect, it } from 'vitest';
import { defaultFinanceState } from '../data/defaults';
import type { TimelineBill } from '../types/finance';
import { billVisualStatus } from './billsTimeline';

function row(partial: Partial<TimelineBill> & Pick<TimelineBill, 'billId' | 'due' | 'category'>): TimelineBill {
  return {
    id: 'test-row',
    name: 'Test',
    amount: 100,
    autoDeduction: false,
    ...partial,
  };
}

describe('billVisualStatus', () => {
  const state = defaultFinanceState();

  it('treats calendar due today as overdue', () => {
    const ref = new Date(2026, 4, 12, 10, 0, 0);
    const due = new Date(2026, 4, 12, 23, 0, 0);
    const b = row({ billId: 'net', due, category: 'essential' });
    expect(billVisualStatus(state, b, ref)).toBe('overdue');
  });

  it('classifies Fri as soon when ref is Tue and lead is 3', () => {
    const ref = new Date(2026, 4, 12, 12, 0, 0); // Tue
    const due = new Date(2026, 4, 15, 0, 0, 0); // Fri — 3 weekdays from Wed
    const b = row({ billId: 'net', due, category: 'essential' });
    expect(billVisualStatus(state, b, ref)).toBe('soon');
  });

  it('classifies a bill four weekdays out as upcoming with default lead 3', () => {
    const ref = new Date(2026, 4, 12, 12, 0, 0); // Tue May 12
    const due = new Date(2026, 4, 19, 0, 0, 0); // Tue May 19 — Wed..Tue next week = 4 weekdays from Wed May 13
    const b = row({ billId: 'net', due, category: 'essential' });
    expect(billVisualStatus(state, b, ref)).toBe('upcoming');
  });
});
