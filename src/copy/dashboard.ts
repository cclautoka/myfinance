import { glossary } from './glossary';

export const dashboard = {
  snapshotTitle: glossary.financialSnapshot,
  snapshotIntro:
    'Tap i for definitions. Planned amounts come from Income & recurring expenses. Deposits are what you log this month.',
  snapshotIntroPreview: 'Tap a metric for definitions. Planned vs deposits for this month.',

  plannedIncomeLabel: glossary.plannedMonthlyIncome,
  plannedIncomeHelper:
    'Husband and wife pay from Household numbers, plus any other regular monthly income. Log one-off cash separately on the Dashboard.',

  leftFromDepositsLabel: glossary.leftFromDeposits,
  leftFromDepositsHelper:
    'Pay logged this month minus bills due so far. Carry-over is shown separately below.',

  carryOverLine: (amount: string) =>
    `${glossary.carryOver}: ${amount} from last month. Not included in deposits or ${glossary.leftFromDeposits.toLowerCase()} above.`,

  depositsLabel: (monthKey: string) => `${glossary.depositsThisMonth} (${monthKey})`,
  logPaychequeCta: glossary.logPaycheque,
  showPaychequeRowsCta: glossary.showPaychequeRows,

  backlogMessage:
    'Some older bills are still open. Open Bill calendar and mark as paid, or fix dates in Household data.',

  savingsRingsNote:
    'We do not link pay deposits to savings automatically. Update the rainy-day balance when money actually lands in that account.',

  projectionDisclaimer:
    'Projections use your current plan and balances. They are illustrative only, not bank or lender forecasts.',

  actualExpenseLabel: 'Actual this month · marked bills + surprises',
  actualExpenseHelper: (monthKey: string) =>
    `Bill calendar rows due in ${monthKey} that you marked as paid (with actual paid when entered), plus one-off surprises logged this month. Same bucket as the cashflow card.`,
} as const;
