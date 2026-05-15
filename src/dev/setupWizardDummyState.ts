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
      otherPlannedIncome: [
        { id: 'dev-rental', label: 'Rental property', amount: 400 },
        { id: 'dev-benefits', label: 'Child benefit', amount: 150 },
      ],
      otherPlannedMonthly: 0,
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
    threeMonthFundTarget: 10000,
    savingsGoals: [
      { id: 'dev-holiday', name: 'Holiday fund', targetAmount: 3000, balance: 800 },
      { id: 'dev-school', name: 'School fees', targetAmount: 2000, balance: 500 },
    ],
    wallets: {
      husbandBudget: 250,
      wifeBudget: 250,
      husbandSpent: 0,
      wifeSpent: 0,
    },
    theme: 'system',
  };
}
