/** Canonical user-facing terms — import everywhere instead of rephrasing. */

export const glossary = {
  markAsPaid: 'Mark as paid',
  undoPaid: 'Undo paid',
  carryOver: 'Carry-over',
  leftFromDeposits: 'Left from deposits',
  plannedMonthlyIncome: 'Planned monthly income',
  depositsThisMonth: 'Deposits this month',
  logPaycheque: 'Log a paycheque',
  showPaychequeRows: 'Show paycheque rows for this month',
  primary: 'Primary',
  partner: 'Partner',
  husband: 'Husband',
  wife: 'Wife',
  joint: 'Joint household',
  workbookOnly: 'Workbook only—not your bank.',
  notBankTransfer: 'This does not move money at the bank.',
  planVsActual: 'We compare plan vs actual on each line.',
  incomeVsSpend: 'Income vs spend this month',
  billCalendar: 'Bill calendar',
  financialSnapshot: 'Financial snapshot',
  reportingPeriod: 'Reporting period',
  actualPaid: 'Actual paid',
  plan: 'Plan',
  paid: 'Paid',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  dueSoon: 'Due soon',
  overLoggedPay: 'over logged pay',
} as const;

export type GlossaryKey = keyof typeof glossary;
