import { describe, expect, it } from 'vitest';
import type { FinanceState } from '../types/finance';
import {
  monthPocketSlackForRollover,
  monthSpendableCarryRemainingSoFar,
  pocketLeftSoFar,
  totalMonthOpeningAllocation,
} from './budgetSurplus';
import { normalizeSavingsGoals } from '../data/storage';

function baseState(overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    version: 1,
    income: {
      husbandMonthly: 2000,
      wifeMonthly: 1400,
      husbandPayNote: '',
      wifePayNote: '',
      husbandPaySchedule: 'weekly',
      wifePaySchedule: 'biweekly',
      husbandTypicalPerPay: 0,
      wifeTypicalPerPay: 0,
    },
    essentials: [],
    debts: [],
    allocation: { savings: 10, personal: 10, groceries: 30, bills: 50 },
    wallets: { husbandBudget: 0, wifeBudget: 0, husbandSpent: 0, wifeSpent: 0 },
    emergencyFund: 500,
    threeMonthFundTarget: 10200,
    savingsGoals: [
      { id: 'legacy-three-month', name: '3-month cushion', targetAmount: 10200, balance: 500 },
    ],
    plannedSavingsMonthly: 0,
    plannedPersonalMonthly: 0,
    billsPaid: {},
    billPaidAmounts: {},
    billsAutoUnmarked: {},
    incomeLog: [],
    extraIncome: [],
    surpriseExpenses: [],
    budgetSurplusSweeps: [],
    monthSpendableCarryByMonth: { '2026-06': 251.21 },
    theme: 'system',
    ...overrides,
  } as FinanceState;
}

describe('pocketLeftSoFar', () => {
  it('is zero at month start when only carry is set (no deposits, no due spend)', () => {
    const state = baseState();
    const ref = new Date('2026-06-01T12:00:00');
    expect(pocketLeftSoFar(state, '2026-06', ref)).toBe(0);
  });

  it('does not subtract savings goal balances', () => {
    const state = baseState({
      savingsGoals: [{ id: 'g1', name: 'Holiday', targetAmount: 1000, balance: 500 }],
    });
    const ref = new Date('2026-06-01T12:00:00');
    expect(pocketLeftSoFar(state, '2026-06', ref)).toBe(0);
  });

  it('subtracts handled bills marked paid even when due after ref', () => {
    const state = baseState({
      monthSpendableCarryByMonth: {},
      incomeLog: [{ id: '1', date: '2026-06-05', amount: 420, earner: 'husband', label: 'Pay' }],
      essentials: [{ id: 'net', name: 'Internet', amount: 150, cadence: 'month', dueDay: 20 }],
      billsPaid: { net: ['2026-06'] },
      billPaidAmounts: { net: { '2026-06': 150 } },
    });
    const ref = new Date('2026-06-01T12:00:00');
    expect(pocketLeftSoFar(state, '2026-06', ref)).toBe(270);
  });

  it('subtracts deposits and due-so-far spend after carry is used first', () => {
    const state = baseState({
      incomeLog: [{ id: '1', date: '2026-06-05', amount: 400, earner: 'husband', label: 'Pay' }],
      essentials: [{ id: 'net', name: 'Internet', amount: 120, cadence: 'month' }],
      billsPaid: { net: ['2026-06'] },
      billPaidAmounts: { net: { '2026-06': 120 } },
    });
    const ref = new Date('2026-06-15T12:00:00');
    expect(pocketLeftSoFar(state, '2026-06', ref)).toBe(400);
    expect(monthSpendableCarryRemainingSoFar(state, '2026-06', ref)).toBe(131.21);
  });

  it('burns carry before deposits go negative', () => {
    const state = baseState({
      incomeLog: [{ id: '1', date: '2026-06-05', amount: 1251.21, earner: 'husband', label: 'Pay' }],
      essentials: [{ id: 'big', name: 'Big bill', amount: 1675.21, cadence: 'month' }],
      billsPaid: { big: ['2026-06'] },
      billPaidAmounts: { big: { '2026-06': 1675.21 } },
    });
    const ref = new Date('2026-06-15T12:00:00');
    expect(pocketLeftSoFar(state, '2026-06', ref)).toBe(-172.79);
    expect(monthSpendableCarryRemainingSoFar(state, '2026-06', ref)).toBe(0);
  });
});

describe('monthPocketSlackForRollover', () => {
  it('does not subtract cumulative goal ring balances', () => {
    const state = baseState({
      monthSpendableCarryByMonth: { '2026-05': 0 },
      incomeLog: [{ id: '1', date: '2026-05-28', amount: 751.21, earner: 'husband', label: 'Pay' }],
      budgetSurplusSweeps: [
        { id: 's1', monthKey: '2026-05', amount: 500, date: '2026-05-28', paidByRole: 'partner' },
      ],
      savingsGoals: [{ id: 'legacy-three-month', name: '3-month cushion', targetAmount: 10200, balance: 500 }],
    });
    expect(monthPocketSlackForRollover(state, '2026-05')).toBe(251.21);
  });
});

describe('totalMonthOpeningAllocation', () => {
  it('sums emergency and goal inputs', () => {
    expect(
      totalMonthOpeningAllocation({ emergency: 50, goals: { g1: 25, g2: 10 } }),
    ).toBe(85);
  });
});

describe('normalizeSavingsGoals', () => {
  it('clears phantom legacy balance mirrored from emergency fund', () => {
    const state = baseState({
      emergencyFund: 500,
      savingsGoals: [{ id: 'legacy-three-month', name: '3-month cushion', targetAmount: 10200, balance: 500 }],
    });
    const next = normalizeSavingsGoals(state);
    expect(next.savingsGoals?.[0]?.balance).toBe(0);
  });

  it('preserves legacy balance when not mirroring emergency fund', () => {
    const state = baseState({
      emergencyFund: 500,
      savingsGoals: [{ id: 'legacy-three-month', name: '3-month cushion', targetAmount: 10200, balance: 120 }],
    });
    const next = normalizeSavingsGoals(state);
    expect(next.savingsGoals?.[0]?.balance).toBe(120);
  });

  it('does not rewrite balance on second load after emergency fund changes', () => {
    const once = normalizeSavingsGoals(
      baseState({
        emergencyFund: 500,
        savingsGoals: [{ id: 'legacy-three-month', name: '3-month cushion', targetAmount: 10200, balance: 500 }],
      }),
    );
    const twice = normalizeSavingsGoals({ ...once, emergencyFund: 800 });
    expect(twice.savingsGoals?.[0]?.balance).toBe(0);
  });
});
