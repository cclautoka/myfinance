import { describe, expect, it } from 'vitest';
import { defaultFinanceState } from '../data/defaults';
import type { FinanceState } from '../types/finance';
import { lifetimePaidByBill, lifetimeSurpriseSpend, trackingMonthKeysThrough } from './paymentHistory';

describe('paymentHistory', () => {
  const withNet = () => ({
    ...defaultFinanceState(),
    essentials: [{ id: 'net', name: 'Internet', amount: 114, cadence: 'month' }],
  });

  it('trackingMonthKeysThrough includes start month through ref month', () => {
    const ref = new Date(2026, 5, 1);
    expect(trackingMonthKeysThrough(ref)).toEqual(['2026-05', '2026-06']);
  });

  it('lifetimePaidByBill uses stored actual when present', () => {
    const base = withNet();
    const state: FinanceState = {
      ...base,
      billsPaid: { ...base.billsPaid, net: ['2026-05'] },
      billPaidAmounts: { ...base.billPaidAmounts, net: { '2026-05': 99 } },
    };
    const ref = new Date(2026, 4, 20);
    const rows = lifetimePaidByBill(state, ref);
    const net = rows.find((r) => r.billId === 'net');
    expect(net?.total).toBe(99);
    expect(net?.paidOccurrences).toBe(1);
  });

  it('lifetimePaidByBill falls back to planned amount when no stored actual', () => {
    const base = withNet();
    const state: FinanceState = {
      ...base,
      billsPaid: { ...base.billsPaid, net: ['2026-05'] },
    };
    const ref = new Date(2026, 4, 20);
    const rows = lifetimePaidByBill(state, ref);
    const net = rows.find((r) => r.billId === 'net');
    expect(net?.total).toBe(114);
    expect(net?.paidOccurrences).toBe(1);
  });

  it('aggregates multiple months for the same bill', () => {
    const base = withNet();
    const state: FinanceState = {
      ...base,
      billsPaid: {
        ...base.billsPaid,
        net: ['2026-05', '2026-06'],
      },
      billPaidAmounts: {
        ...base.billPaidAmounts,
        net: { '2026-05': 100, '2026-06': 110 },
      },
    };
    const ref = new Date(2026, 5, 15);
    const rows = lifetimePaidByBill(state, ref);
    const net = rows.find((r) => r.billId === 'net');
    expect(net?.total).toBe(210);
    expect(net?.paidOccurrences).toBe(2);
  });

  it('lifetimeSurpriseSpend aggregates entries into one bar', () => {
    const state: FinanceState = {
      ...defaultFinanceState(),
      surpriseExpenses: [
        { id: 'a', label: 'Car repair', date: '2026-05-10', amount: 200, category: 'other' },
        { id: 'b', label: 'Vet', date: '2026-06-02', amount: 75, category: 'other' },
      ],
    };
    const rows = lifetimeSurpriseSpend(state);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Unexpected Expense');
    expect(rows[0]?.total).toBe(275);
    expect(rows[0]?.paidOccurrences).toBe(2);
    expect(rows[0]?.lastPaidDate).toBe('2026-06-02');
  });
});
