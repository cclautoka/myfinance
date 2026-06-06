import { describe, expect, it } from 'vitest';
import type { FinanceState } from '../types/finance';
import {
  applyAutoMarkHandled,
  autoDeductionPaidByRole,
  syncAutoDeductionBillAttribution,
} from './autoBills';

function baseState(): FinanceState {
  return {
    version: 1,
    income: {
      husbandMonthly: 2000,
      wifeMonthly: 0,
      husbandPayNote: '',
      wifePayNote: '',
      husbandPaySchedule: 'weekly',
      wifePaySchedule: 'biweekly',
      husbandTypicalPerPay: 0,
      wifeTypicalPerPay: 0,
    },
    essentials: [],
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
        autoDeductionPaidByRole: 'owner',
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
      'hp-phone': ['2026-06'],
      'hp-laptop': ['2026-06'],
    },
    billPaidAmounts: {
      'hp-phone': { '2026-06': 281 },
      'hp-laptop': { '2026-06': 143 },
    },
    billsAutoUnmarked: {},
    incomeLog: [],
    extraIncome: [],
    surpriseExpenses: [],
    budgetSurplusSweeps: [],
    monthSpendableCarryByMonth: {},
    theme: 'system',
  } as FinanceState;
}

describe('autoDeductionPaidByRole', () => {
  it('defaults to Primary when unset', () => {
    expect(autoDeductionPaidByRole(baseState().debts[0])).toBe('owner');
  });

  it('uses configured role', () => {
    expect(autoDeductionPaidByRole(baseState().debts[1])).toBe('owner');
  });
});

describe('syncAutoDeductionBillAttribution', () => {
  it('tags auto-marked bills missing attribution as Primary by default', () => {
    const next = syncAutoDeductionBillAttribution(baseState());
    expect(next.billPaymentAttribution?.['hp-phone']?.['2026-06']?.role).toBe('owner');
    expect(next.billPaymentAttribution?.['hp-laptop']?.['2026-06']?.role).toBe('owner');
  });

  it('does not overwrite existing attribution', () => {
    const state = {
      ...baseState(),
      billPaymentAttribution: {
        'hp-phone': {
          '2026-06': { role: 'partner', platform: 'web', at: '2026-06-04T00:00:00.000Z' },
        },
      },
    } as FinanceState;
    const next = syncAutoDeductionBillAttribution(state);
    expect(next.billPaymentAttribution?.['hp-phone']?.['2026-06']?.role).toBe('partner');
  });
});

describe('applyAutoMarkHandled', () => {
  it('sets attribution when auto-marking after due day', () => {
    const state = {
      ...baseState(),
      billsPaid: {},
      billPaidAmounts: {},
    } as FinanceState;
    const ref = new Date('2026-06-06T12:00:00');
    const next = applyAutoMarkHandled(state, ref);
    expect(next.billsPaid['hp-phone']).toContain('2026-06');
    expect(next.billPaymentAttribution?.['hp-phone']?.['2026-06']?.role).toBe('owner');
  });
});
