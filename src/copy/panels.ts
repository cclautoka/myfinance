import { glossary } from './glossary';

export const panels = {
  incomeSpend: {
    title: glossary.incomeVsSpend,
    subtitle:
      'Primary = husband’s logged pay. Partner = wife’s. Dark bar = bills and surprises attributed to that person. Red = spent more than logged pay.',
    empty:
      'Log pay in the Paycheque log, then mark bills as paid or add surprise costs to see Primary vs Partner bars.',
    unassigned: (total: string, count: number) =>
      `${total} in marked bills are not tied to Primary or Partner yet (${count} item${count === 1 ? '' : 's'}).`,
    overLoggedPay: glossary.overLoggedPay,
  },
  incomeLog: {
    dashboardTitle: 'Paycheque log',
    dashboardSubtitle: (monthHeading: string, monthKey: string) =>
      `Deposits dated in ${monthHeading} (${monthKey}) update Deposits this month on the snapshot above.`,
    pastMonthTitle: 'Paycheque log — past month',
    pastMonthSubtitle: (monthHeading: string, monthKey: string) =>
      `Editing deposits for ${monthHeading} (${monthKey}). Log the current month on the Dashboard instead.`,
    nothingAutoLead: 'Nothing imports from your bank automatically.',
    nothingAutoDashboard: 'New rows appear below and update the snapshot totals.',
    nothingAutoPast: 'Rows dated in another month move when you change the deposit date.',
    changeDateHint: 'Change the deposit date to move a row between months.',
    depositsRecordedLabel: (monthKey: string) => `Deposits this month (${monthKey})`,
  },
  billsLifetime: {
    title: 'Life spends (lifetime)',
    subtitle: (sinceLabel: string) =>
      `Since ${sinceLabel}: bills you marked as paid plus unexpected expenses you logged.`,
    empty: 'No lifetime spends yet. Mark bills as paid on the calendar or log an unexpected expense.',
  },
  budgetSurplus: {
    title: 'Cash left this month → emergency savings',
    subtitle:
      'Logged pay and extras, plus optional carry-over, minus bills marked as paid and surprises. Move surplus to your emergency balance when you choose.',
  },
  emergency: {
    title: 'Backup (emergency) account',
    subtitle: 'Type the balance in your joint saver. The app never reads your bank.',
  },
  allocation: {
    title: 'Monthly money split',
    subtitle:
      'Enter savings and personal as monthly dollars. The chart sizes wedges from Household rows plus those amounts.',
  },
  dataEditor: {
    title: 'Line-by-line edits',
    subtitle: 'Everything on the Dashboard reads these rows: income first, then bills, then debts.',
  },
  pastMonth: {
    subtitle:
      'Bills, paycheque log, extra cash, and surprises for the month you picked. Use the Dashboard for the current month.',
    markedRatio: 'Bill lines marked as paid',
    notMarked: 'Not marked as paid (due this month)',
  },
  debtBalances: {
    title: 'What you owe — snapshot',
    subtitle:
      'From loan rows under Your income & regular bills. You refresh balances. APR is optional for a rough interest hint only.',
  },
  debtSnowball: {
    title: 'Payoff order cheer chart',
    titleCompact: 'Debt payoff snapshot',
    subtitle: 'Smallest balances first for motivation. Bars scale to the largest remaining balance on the list.',
    subtitleCompact:
      'Smallest balance first. Bar length shows what is left on each debt. Grey strips use the same scale.',
  },
  monthlyReport: {
    subtitle: 'Open a summary or download CSV for the month you chose—not today’s live Dashboard.',
  },
  audit: {
  intro:
    'Changes sync from any device. Marking a bill as paid, editing amounts, or logging pay each create a row after sync.',
  },
  wallet: {
    title: 'Fun money per person',
    subtitle:
      'Split the Personal slice from your plan. Set each budget yourself. Spent taps reset each month.',
  },
} as const;
