import { describe, expect, it } from 'vitest';
import { defaultFinanceState } from '../data/defaults';
import type { FinanceState } from '../types/finance';
import { lifetimePaidByBill, trackingMonthKeysThrough } from './paymentHistory';

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
});
