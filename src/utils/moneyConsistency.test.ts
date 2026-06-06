import { describe, expect, it } from 'vitest';
import type { FinanceState } from '../types/finance';
import { pocketLeftSoFar } from './budgetSurplus';
import { monthIncomeSpendSummary } from './householdIncomeSpend';
import { upcomingDeductionsTotal } from './billsTimeline';
import {
  billCalendarHeadsUp,
  solePrimaryPocketMatchesChart,
  weeksRemainingInMonth,
} from './moneyConsistency';
import { computeSafeSpend } from './safeSpend';

export function juneShahilFixture(): FinanceState {
  return {
    version: 1,
    income: {
      husbandMonthly: 1600,
      wifeMonthly: 0,
      husbandPayNote: '',
      wifePayNote: '',
      husbandPaySchedule: 'weekly',
      wifePaySchedule: 'biweekly',
      husbandTypicalPerPay: 0,
      wifeTypicalPerPay: 0,
    },
    essentials: [
      { id: 'food', name: 'Groceries', amount: 150, cadence: 'week', weeklyDueWeekday: 6 },
    ],
    debts: [
      {
        id: 'hp-phone',
        name: 'HP Phone',
        balance: 0,
        monthlyPayment: 281,
        dueDay: 4,
        autoDeduction: true,
        kind: 'installment',
      },
      {
        id: 'hp-laptop',
        name: 'HP Laptop',
        balance: 0,
        monthlyPayment: 143,
        dueDay: 5,
        autoDeduction: true,
        kind: 'installment',
      },
    ],
    allocation: { essentials: 25, debt: 25, savings: 25, groceries: 25, personal: 0 },
    wallets: { husbandBudget: 0, wifeBudget: 0, husbandSpent: 0, wifeSpent: 0 },
    emergencyFund: 0,
    threeMonthFundTarget: 0,
    savingsGoals: [],
    plannedSavingsMonthly: 0,
    plannedPersonalMonthly: 0,
    billsPaid: {
      food: ['2026-06-06'],
      'hp-phone': ['2026-06'],
      'hp-laptop': ['2026-06'],
    },
    billPaidAmounts: {
      food: { '2026-06-06': 150 },
      'hp-phone': { '2026-06': 281 },
      'hp-laptop': { '2026-06': 143 },
    },
    billPaymentAttribution: {
      food: { '2026-06-06': { role: 'owner', platform: 'web', at: '2026-06-06T00:00:00.000Z' } },
      'hp-phone': { '2026-06': { role: 'owner', platform: 'web', at: '2026-06-04T00:00:00.000Z' } },
      'hp-laptop': { '2026-06': { role: 'owner', platform: 'web', at: '2026-06-05T00:00:00.000Z' } },
    },
    billsAutoUnmarked: {},
    incomeLog: [{ id: '1', date: '2026-06-05', amount: 473.69, earner: 'husband', label: 'Pay' }],
    extraIncome: [],
    surpriseExpenses: [],
    budgetSurplusSweeps: [],
    monthSpendableCarryByMonth: { '2026-06': 251.21 },
    theme: 'system',
  } as FinanceState;
}

describe('money consistency (June Shahil fixture)', () => {
  const ref = new Date('2026-06-06T12:00:00');
  const mk = '2026-06';
  const state = juneShahilFixture();

  it('pocket left matches carry + pay − spent due so far', () => {
    expect(pocketLeftSoFar(state, mk, ref)).toBe(150.9);
  });

  it('income chart Primary remaining matches pocket for sole depositor', () => {
    expect(solePrimaryPocketMatchesChart(state, mk, ref)).toBe(true);
    const primary = monthIncomeSpendSummary(state, mk).rows.find((r) => r.key === 'owner');
    expect(primary?.remaining).toBe(150.9);
  });

  it('bill calendar heads-up uses same pocket left', () => {
    const headsUp = billCalendarHeadsUp(state, 10, ref);
    expect(headsUp.pocketLeft).toBe(150.9);
    expect(headsUp.tight).toBe(headsUp.upcomingTotal > 150.9);
  });

  it('safe spend weekly hint derives from pocket minus upcoming window', () => {
    const safe = computeSafeSpend(state, 14, ref);
    const upcoming14 = upcomingDeductionsTotal(state, 14, ref);
    expect(safe.monthlyFlex).toBe(150.9);
    expect(safe.weeklyHint).toBeGreaterThanOrEqual(0);
    expect(safe.afterUpcomingWindow).toBe(Math.max(0, 150.9 - upcoming14));
  });
});

describe('weeksRemainingInMonth', () => {
  it('returns at least one week', () => {
    expect(weeksRemainingInMonth(new Date('2026-06-06'))).toBeGreaterThanOrEqual(1);
  });
});
