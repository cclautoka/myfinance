/**
 * Fresh-start workbook: your real loans, expenses, and pay setup, but with a clean slate
 * from "today" — no historical paid bills, no past paycheque log, no prior month seals.
 *
 * Used by `seed-fresh-start.mjs`. Adjust balances here if any have changed since the last snapshot.
 */
export function buildFreshStartFinanceState(today = new Date()) {
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayIso = `${monthKey}-${String(today.getDate()).padStart(2, '0')}`;

  return {
    version: 1,
    income: {
      husbandMonthly: 1600,
      wifeMonthly: 1800,
      husbandPayNote: 'Weekly, every Friday',
      wifePayNote: 'Biweekly — Thursdays',
      husbandPaySchedule: 'weekly',
      wifePaySchedule: 'biweekly',
      husbandTypicalPerPay: 400,
      wifeTypicalPerPay: 830.77,
      // Forward-only auto pay logging: anchor on today so nothing backfills with old dates.
      husbandPayAutoLog: false,
      husbandPayAnchor: todayIso,
      wifePayAutoLog: true,
      wifeBiweeklyPayAnchor: todayIso,
      otherPlannedMonthly: 0,
      otherPlannedIncome: [],
    },
    essentials: [
      { id: 'net', name: 'Internet', amount: 114, cadence: 'month', dueDay: 15 },
      { id: 'efl', name: 'EFL Electricity', amount: 110, cadence: 'month', dueDay: 15 },
      { id: 'rent', name: 'Rent', amount: 400, cadence: 'month', dueDay: 22 },
      { id: 'food', name: 'Groceries', amount: 150, cadence: 'week', weeklyDueWeekday: 6 },
    ],
    debts: [
      {
        id: 'bsp',
        name: 'BSP Credit Card',
        balance: 10_000,
        monthlyPayment: 600,
        dueDay: 21,
        autoDeduction: false,
        kind: 'card',
        annualInterestApr: 25,
      },
      {
        id: 'anz',
        name: 'ANZ Credit Card',
        balance: 2500,
        monthlyPayment: 200,
        dueDay: 11,
        autoDeduction: false,
        kind: 'card',
        annualInterestApr: 20.5,
      },
      {
        id: 'car',
        name: 'Car Loan',
        balance: 0,
        monthlyPayment: 224,
        dueDay: 20,
        autoDeduction: true,
        endsOn: '2027-11-30',
        kind: 'loan',
      },
      {
        id: 'shamil',
        name: 'Personal — Shamil',
        balance: 2800,
        monthlyPayment: 0,
        dueDay: 28,
        autoDeduction: false,
        kind: 'personal',
      },
      {
        id: 'farun',
        name: 'Personal — Farun',
        balance: 2000,
        monthlyPayment: 0,
        dueDay: 28,
        autoDeduction: false,
        kind: 'personal',
      },
    ],
    allocation: { essentials: 18, groceries: 18, debt: 43, savings: 12, personal: 9 },
    wallets: {
      husbandBudget: 0,
      wifeBudget: 500,
      husbandSpent: 0,
      wifeSpent: 0,
    },
    emergencyFund: 0,
    threeMonthFundTarget: 10_200,
    savingsGoals: [],
    plannedSavingsMonthly: 500,
    plannedPersonalMonthly: 500,
    // Clean slate — no history before today.
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
    walletResetMonth: monthKey,
    billOverdueGraceDays: 0,
    billUpcomingLeadBusinessDays: 3,
    pushNotificationPrefs: { billReminders: true },
  };
}
