import { defaultFinanceState } from '../data/defaults';
import type { FinanceState } from '../types/finance';

/** Rich sample workbook for layout / CSS preview of the setup wizard. */
export function createSetupWizardDummyState(): FinanceState {
  const base = defaultFinanceState();
  return {
    ...base,
    income: {
      ...base.income,
      husbandMonthly: 3200,
      wifeMonthly: 2800,
      otherPlannedMonthly: 400,
    },
    essentials: [
      { id: 'dev-rent', name: 'Rent', amount: 400, cadence: 'month', dueDay: 22 },
      { id: 'dev-internet', name: 'Internet', amount: 114, cadence: 'month', dueDay: 15 },
      { id: 'dev-electric', name: 'EFL Electricity', amount: 120, cadence: 'month', dueDay: 15 },
      { id: 'dev-food', name: 'Groceries', amount: 150, cadence: 'week', weeklyDueWeekday: 6 },
    ],
    debts: [
      {
        id: 'dev-bsp',
        name: 'BSP Credit Card',
        balance: 10000,
        monthlyPayment: 600,
        dueDay: 21,
        autoDeduction: false,
        endsOn: null,
        kind: 'card',
        annualInterestApr: 25,
      },
      {
        id: 'dev-hp-phone',
        name: 'HP Phone',
        balance: 0,
        monthlyPayment: 200,
        dueDay: 4,
        autoDeduction: true,
        endsOn: '2026-08-01',
        kind: 'installment',
        annualInterestApr: 0,
      },
    ],
    plannedSavingsMonthly: 500,
    plannedPersonalMonthly: 500,
    emergencyFund: 2400,
    threeMonthFundTarget: 10200,
    wallets: {
      husbandBudget: 250,
      wifeBudget: 250,
      husbandSpent: 0,
      wifeSpent: 0,
    },
    theme: 'system',
  };
}
