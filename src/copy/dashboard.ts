import { glossary } from './glossary';

export const dashboard = {
  snapshotTitle: glossary.financialSnapshot,
  snapshotIntro: 'Use the info buttons on each metric for definitions.',
  snapshotIntroPreview: 'Planned vs deposits for this month.',

  plannedIncomeLabel: glossary.plannedMonthlyIncome,
  plannedIncomeHelper: 'From Household numbers. Log one-off cash on the Dashboard.',

  leftFromDepositsLabel: glossary.leftFromDeposits,
  leftFromDepositsHelper: 'Deposits minus bills you marked paid this month. Carry-over is used first.',

  carryOverLine: (amount: string) => `${glossary.carryOver} ${amount} remaining.`,

  depositsLabel: (monthKey: string) => `${glossary.depositsThisMonth} (${monthKey})`,
  logPaychequeCta: glossary.logPaycheque,
  showPaychequeRowsCta: glossary.showPaychequeRows,

  backlogMessage:
    'Some older bills are still open. Open Bill calendar and mark as paid, or fix dates in Household data.',

  savingsRingsNote: 'Update the rainy-day balance when money lands in that account.',

  projectionDisclaimer: 'Illustrative only—not bank or lender forecasts.',

  actualExpenseLabel: 'Actual this month',
  actualExpenseHelper: () => 'Marked bills and surprises logged this month.',
} as const;
