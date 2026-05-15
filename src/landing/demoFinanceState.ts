import { currentMonthKey, defaultFinanceState } from '../data/defaults';
import type { FinanceState } from '../types/finance';

/** Fake household data for the public demo only — never persisted. */
export function buildDemoFinanceState(): FinanceState {
  const mk = currentMonthKey();
  const base = defaultFinanceState();
  return {
    ...base,
    income: {
      ...base.income,
      husbandMonthly: 5200,
      wifeMonthly: 2800,
      husbandPaySchedule: 'monthly',
      wifePaySchedule: 'biweekly',
      husbandTypicalPerPay: 5200,
      wifeTypicalPerPay: 1400,
    },
    essentials: [
      { id: 'demo-rent', name: 'Rent', amount: 1850, cadence: 'month', dueDay: 1 },
      { id: 'demo-power', name: 'Power', amount: 140, cadence: 'month', dueDay: 12 },
      { id: 'demo-net', name: 'Internet', amount: 89, cadence: 'month', dueDay: 18 },
    ],
    debts: [
      {
        id: 'demo-card',
        name: 'Card balance',
        balance: 2400,
        monthlyPayment: 120,
        dueDay: 15,
        autoDeduction: false,
        kind: 'card',
        annualInterestApr: 19.9,
      },
    ],
    allocation: { essentials: 35, groceries: 15, debt: 25, savings: 15, personal: 10 },
    wallets: { husbandBudget: 400, wifeBudget: 350, husbandSpent: 120, wifeSpent: 85 },
    emergencyFund: 3200,
    threeMonthFundTarget: 12000,
    plannedSavingsMonthly: 600,
    plannedPersonalMonthly: 400,
    incomeLog: [
      {
        id: 'demo-log-1',
        amount: 5200,
        date: `${mk}-01`,
        label: 'Pay — Alex',
        earner: 'husband',
      },
    ],
    billsPaid: { 'demo-rent': [mk] },
    theme: 'system',
  };
}
