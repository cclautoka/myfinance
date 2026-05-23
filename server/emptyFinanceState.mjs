/**
 * Blank worksheet JSON for new households (mirrors src/data/defaults.ts defaultFinanceState).
 * Keep in sync when adding required FinanceState fields.
 */
export function buildEmptyFinanceState() {
  const now = new Date();
  const walletResetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    version: 1,
    income: {
      husbandMonthly: 0,
      wifeMonthly: 0,
      husbandPayNote: '',
      wifePayNote: '',
      husbandPaySchedule: 'monthly',
      wifePaySchedule: 'monthly',
      husbandTypicalPerPay: 0,
      wifeTypicalPerPay: 0,
      husbandPayAutoLog: false,
      husbandPayAnchor: null,
      wifePayAutoLog: false,
      wifeBiweeklyPayAnchor: null,
      otherPlannedMonthly: 0,
      otherPlannedIncome: [],
    },
    essentials: [],
    debts: [],
    allocation: {
      essentials: 20,
      groceries: 20,
      debt: 20,
      savings: 20,
      personal: 20,
    },
    wallets: {
      husbandBudget: 0,
      wifeBudget: 0,
      husbandSpent: 0,
      wifeSpent: 0,
    },
    emergencyFund: 0,
    threeMonthFundTarget: 0,
    savingsGoals: [],
    plannedSavingsMonthly: 0,
    plannedPersonalMonthly: 0,
    billsPaid: {},
    billPaidAmounts: {},
    billsAutoUnmarked: {},
    incomeLog: [],
    extraIncome: [],
    surpriseExpenses: [],
    budgetSurplusSweeps: [],
    monthSpendableCarryByMonth: {},
    monthCashflowOpening: {},
    theme: 'system',
    walletResetMonth,
    billOverdueGraceDays: 0,
    billUpcomingLeadBusinessDays: 3,
    pushNotificationPrefs: { billReminders: true },
  };
}
