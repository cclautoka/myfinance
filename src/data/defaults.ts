import type { FinanceState } from '../types/finance';

/** Calendar bucket for a bill’s due date (must align with checklist toggles). */
export const dateToMonthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Local calendar date for that row’s payout day (weekly groceries = one key per shopping week). */
export const dueDateLocalKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const currentMonthKey = (): string => dateToMonthKey(new Date());

export const parseCalendarMonthKey = (
  mk: string,
): { year: number; monthIndex: number } | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(mk.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthNum = Number(m[2]);
  if (monthNum < 1 || monthNum > 12) return null;
  return { year, monthIndex: monthNum - 1 };
};

/** Previous calendar bucket YYYY-MM (for month-opening / rollover from `mk`). */
export const previousCalendarMonthKey = (mk: string): string => {
  const p = parseCalendarMonthKey(mk);
  if (!p) return mk;
  const d = new Date(p.year, p.monthIndex, 0);
  return dateToMonthKey(d);
};

/** Most recent first: current calendar month plus `extras` earlier months */
export const formatCalendarMonthHeading = (mk: string): string => {
  const p = parseCalendarMonthKey(mk);
  if (!p) return mk;
  return new Date(p.year, p.monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
};

export function rollingMonthKeys(monthsBack: number, ref = new Date()): string[] {
  const out: string[] = [];
  let y = ref.getFullYear();
  let m = ref.getMonth();
  for (let i = 0; i <= monthsBack; i++) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    if (m === 0) {
      y--;
      m = 11;
    } else {
      m--;
    }
  }
  return out;
}

/** First month listed in History (the month before in-app tracking below). */
export const HISTORY_EARLIEST_MONTH_KEY = '2026-04';

/**
 * First month the household checklist & overdue logic apply (forward timeline, History bill rows, MTD counts).
 * April {@link HISTORY_EARLIEST_MONTH_KEY} stays in History as an empty “before we started” bucket.
 */
export const HISTORY_TRACKING_STARTED_MONTH_KEY = '2026-05';

/** Local midnight on the 1st of {@link HISTORY_TRACKING_STARTED_MONTH_KEY} — no bill occurrences before this are shown. */
export function billTrackingEarliestDueDate(): Date {
  const p = parseCalendarMonthKey(HISTORY_TRACKING_STARTED_MONTH_KEY);
  if (!p) return new Date(2026, 4, 1);
  return new Date(p.year, p.monthIndex, 1);
}

/** Calendar month immediately before `ref` (local). */
export const previousCalendarMonthFromDate = (ref = new Date()): string => {
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1);
  d.setMonth(d.getMonth() - 1);
  return dateToMonthKey(d);
};

export const calendarMonthKeyMinusMonths = (mk: string, deltaMonths: number): string | null => {
  const p = parseCalendarMonthKey(mk);
  if (!p) return null;
  const d = new Date(p.year, p.monthIndex, 1);
  d.setMonth(d.getMonth() + deltaMonths);
  return dateToMonthKey(d);
};

/**
 * Months available in History: strictly before the current calendar month, down to HISTORY_EARLIEST_MONTH_KEY, newest first.
 */
export function historySelectableMonthKeys(ref = new Date()): string[] {
  const earliest = HISTORY_EARLIEST_MONTH_KEY;
  const keys: string[] = [];
  let mk: string | null = previousCalendarMonthFromDate(ref);
  for (let i = 0; i < 24; i++) {
    if (!mk || mk < earliest) break;
    keys.push(mk);
    mk = calendarMonthKeyMinusMonths(mk, -1);
  }
  return keys;
}

/**
 * Empty worksheet for first-time visitors (no demo dollars or debts).
 * “Reset” in Tools uses the same baseline.
 */
export const defaultFinanceState = (): FinanceState => ({
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
  walletResetMonth: currentMonthKey(),
  billOverdueGraceDays: 0,
  billUpcomingLeadBusinessDays: 3,
  pushNotificationPrefs: { billReminders: true },
});
