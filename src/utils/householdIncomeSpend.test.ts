import { describe, expect, it } from 'vitest';
import type { FinanceState } from '../types/finance';
import { monthIncomeSpendSummary } from './householdIncomeSpend';

function baseState(): FinanceState {
  return {
    version: 1,
    income: {
      husbandMonthly: 2000,
      wifeMonthly: 800,
      husbandPayNote: '',
      wifePayNote: '',
      husbandPaySchedule: 'weekly',
      wifePaySchedule: 'biweekly',
      husbandTypicalPerPay: 0,
      wifeTypicalPerPay: 0,
    },
    essentials: [{ id: 'rent', name: 'Rent', amount: 400, cadence: 'month', dueDay: 1 }],
    debts: [],
    allocation: { savings: 10, personal: 10, groceries: 30, bills: 50 },
    wallets: { husbandBudget: 0, wifeBudget: 0, husbandSpent: 0, wifeSpent: 0 },
    emergencyFund: 0,
    threeMonthFundTarget: 0,
    savingsGoals: [],
    plannedSavingsMonthly: 0,
    plannedPersonalMonthly: 0,
    billsPaid: { rent: ['2026-05'] },
    billPaidAmounts: { rent: { '2026-05': 400 } },
    billPaymentAttribution: {
      rent: {
        '2026-05': {
          role: 'owner',
          memberEmail: 'a@test.com',
          platform: 'web',
          at: '2026-05-01T00:00:00.000Z',
        },
      },
    },
    billsAutoUnmarked: {},
    incomeLog: [
      { id: '1', date: '2026-05-10', amount: 500, earner: 'husband', label: 'Pay' },
      { id: '2', date: '2026-05-12', amount: 300, earner: 'wife', label: 'Pay' },
    ],
    extraIncome: [{ id: 'e1', label: 'Bonus', amount: 100, date: '2026-05-15', category: 'bonus' }],
    surpriseExpenses: [
      {
        id: 's1',
        label: 'Meds',
        amount: 50,
        date: '2026-05-16',
        category: 'medical',
        paidByRole: 'owner',
      },
    ],
    budgetSurplusSweeps: [],
    monthSpendableCarryByMonth: {},
    theme: 'system',
  } as FinanceState;
}

describe('monthIncomeSpendSummary', () => {
  it('maps husband income to Primary and wife to Partner', () => {
    const summary = monthIncomeSpendSummary(baseState(), '2026-05');
    const primary = summary.rows.find((r) => r.key === 'owner');
    const partner = summary.rows.find((r) => r.key === 'partner');
    expect(primary?.incomeLogged).toBe(500);
    expect(partner?.incomeLogged).toBe(300);
    expect(primary?.billsTotal).toBe(400);
    expect(primary?.surprisesTotal).toBe(50);
    expect(primary?.spent).toBe(450);
    expect(primary?.remaining).toBe(50);
    expect(primary?.overspend).toBe(0);
  });

  it('includes extra cash row when present', () => {
    const summary = monthIncomeSpendSummary(baseState(), '2026-05');
    const extra = summary.rows.find((r) => r.key === 'extra');
    expect(extra?.incomeLogged).toBe(100);
    expect(extra?.spent).toBe(0);
  });
});
