import {
  billTrackingEarliestDueDate,
  dateToMonthKey,
  dueDateLocalKey,
  HISTORY_TRACKING_STARTED_MONTH_KEY,
  parseCalendarMonthKey,
} from '../data/defaults';
import type { DebtAccount, EssentialExpense, FinanceState, TimelineBill } from '../types/finance';
import {
  businessWeekdaysFromTomorrowThroughDueInclusive,
  calendarDaysAfterDue,
  startOfLocalDay,
} from './businessDays';
import { allocationBreakdown } from './allocation';

/** Passed from the timeline row when toggling handled / undo. */
export type BillsTogglePayload = Pick<TimelineBill, 'billId' | 'due' | 'category'> & {
  /** Display name for toast feedback */
  label?: string;
};

/** Same as toggle row; include `actualPaid` when marking paid (defaults to planned in UI). */
export type BillsPaidTogglePayload = BillsTogglePayload & {
  actualPaid?: number;
  /** Display name for toast feedback */
  label?: string;
};

/** Storage key per timeline row — weekly essentials get a day bucket; debts & monthly essentials use YYYY-MM. */
export function billPaymentKey(state: FinanceState, row: BillsTogglePayload): string {
  if (row.category === 'essential') {
    const e = state.essentials.find((x) => x.id === row.billId);
    if (e?.cadence === 'week') return dueDateLocalKey(row.due);
  }
  return dateToMonthKey(row.due);
}

export function billOccurrenceIsPaid(state: FinanceState, b: BillsTogglePayload): boolean {
  const k = billPaymentKey(state, b);
  return (state.billsPaid[b.billId] ?? []).includes(k);
}

/** Recorded actual for this occurrence — `undefined` if only plan is known (legacy / auto-fill). */
export function billPaidStoredAmount(state: FinanceState, row: BillsTogglePayload): number | undefined {
  const k = billPaymentKey(state, row);
  const v = state.billPaidAmounts[row.billId]?.[k];
  if (v === undefined || !Number.isFinite(v)) return undefined;
  return v;
}

/** Amount to attribute as paid for display when the line is marked handled. */
export function billOccurrencePaidDisplayAmount(
  state: FinanceState,
  row: BillsTogglePayload,
  plannedAmount: number,
): number {
  const stored = billPaidStoredAmount(state, row);
  return stored !== undefined ? stored : plannedAmount;
}

const setDaySafe = (year: number, monthIndex: number, day: number): Date => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const d = Math.min(day, last);
  return new Date(year, monthIndex, d);
};

const essentialInstancesForMonth = (
  e: EssentialExpense,
  year: number,
  monthIndex: number,
): { due: Date; amount: number }[] => {
  if (e.cadence === 'month') {
    const dom =
      e.dueDay != null && e.dueDay >= 1 && e.dueDay <= 31
        ? Math.floor(e.dueDay)
        : 15;
    return [{ due: setDaySafe(year, monthIndex, dom), amount: e.amount }];
  }
  const out: { due: Date; amount: number }[] = [];
  const lastDom = new Date(year, monthIndex + 1, 0).getDate();
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const targetDowRaw = e.weeklyDueWeekday;
  const targetDow =
    targetDowRaw != null &&
    Number.isFinite(targetDowRaw) &&
    targetDowRaw >= 0 &&
    targetDowRaw <= 6
      ? Math.floor(targetDowRaw)
      : 6;
  let dom = 1 + ((targetDow - firstDow + 7) % 7);
  while (dom <= lastDom) {
    out.push({ due: new Date(year, monthIndex, dom), amount: e.amount });
    dom += 7;
  }
  if (out.length === 0) {
    out.push({ due: new Date(year, monthIndex, Math.min(7, lastDom)), amount: e.amount });
  }
  return out;
};

const debtInstancesForMonth = (d: DebtAccount, year: number, monthIndex: number): TimelineBill[] => {
  if (d.endsOn) {
    const end = new Date(d.endsOn);
    const due = setDaySafe(year, monthIndex, d.dueDay);
    if (due.getTime() > end.getTime()) return [];
  }
  const due = setDaySafe(year, monthIndex, d.dueDay);
  return [
    {
      id: `${d.id}-${year}-${monthIndex}`,
      billId: d.id,
      name: d.name,
      amount: d.monthlyPayment,
      due,
      autoDeduction: d.autoDeduction,
      category: 'debt',
    },
  ];
};

/** All scheduled payment occurrences from tracking start through contract `endsOn`. */
export function debtContractOccurrences(
  d: DebtAccount,
  fromMonthKey: string = HISTORY_TRACKING_STARTED_MONTH_KEY,
): TimelineBill[] {
  if (!d.endsOn || d.monthlyPayment <= 0) return [];
  const startP = parseCalendarMonthKey(fromMonthKey);
  if (!startP) return [];
  const end = new Date(d.endsOn);
  const items: TimelineBill[] = [];
  let y = startP.year;
  let m = startP.monthIndex;
  const endY = end.getFullYear();
  const endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    items.push(...debtInstancesForMonth(d, y, m));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return items;
}

/** Sum of unpaid contract payments still on the calendar (HP / loans with blank balance). */
export function unpaidDebtContractRemaining(state: FinanceState, d: DebtAccount): number {
  let sum = 0;
  for (const b of debtContractOccurrences(d)) {
    if (billOccurrenceIsPaid(state, b)) continue;
    sum += billOccurrencePaidDisplayAmount(state, b, b.amount);
  }
  return Math.round(sum * 100) / 100;
}

/** All calendar occurrences for a debt row (contract schedule or rolling timeline). */
export function debtPaymentOccurrences(state: FinanceState, d: DebtAccount, ref = new Date()): TimelineBill[] {
  if (d.endsOn && d.monthlyPayment > 0) return debtContractOccurrences(d);
  return buildTimeline(state, 24, ref).filter((b) => b.billId === d.id);
}

/** Earliest unpaid installment on the bill calendar for this debt. */
export function nextUnpaidDebtOccurrence(
  state: FinanceState,
  debtId: string,
  ref = new Date(),
): TimelineBill | null {
  const d = state.debts.find((x) => x.id === debtId);
  if (!d || d.monthlyPayment <= 0) return null;
  const sorted = [...debtPaymentOccurrences(state, d, ref)].sort((a, b) => a.due.getTime() - b.due.getTime());
  return sorted.find((b) => !billOccurrenceIsPaid(state, b)) ?? null;
}

/** How many months backward we scan for unchecked past dues (overlap with paycheck timing). */
const TIMELINE_LOOKBACK_MONTHS = 6;

export function billReminderPrefs(state: FinanceState): {
  overdueGraceDays: number;
  upcomingLeadBusinessDays: number;
} {
  const grace = Math.min(60, Math.max(0, Math.floor(state.billOverdueGraceDays ?? 0)));
  const lead = Math.min(30, Math.max(1, Math.floor(state.billUpcomingLeadBusinessDays ?? 3)));
  return { overdueGraceDays: grace, upcomingLeadBusinessDays: lead };
}

export const buildTimeline = (state: FinanceState, monthsAhead = 3, ref = new Date()): TimelineBill[] => {
  const items: TimelineBill[] = [];
  const y0 = ref.getFullYear();
  const m0 = ref.getMonth();
  const trackingMonthStart = billTrackingEarliestDueDate().getTime();

  for (let i = -TIMELINE_LOOKBACK_MONTHS; i < monthsAhead; i++) {
    const dt = new Date(y0, m0 + i, 1);
    const year = dt.getFullYear();
    const monthIndex = dt.getMonth();
    const thisMonthStart = new Date(year, monthIndex, 1).getTime();
    if (thisMonthStart < trackingMonthStart) continue;

    for (const e of state.essentials) {
      for (const inst of essentialInstancesForMonth(e, year, monthIndex)) {
        items.push({
          id: `${e.id}-${inst.due.toISOString()}`,
          billId: e.id,
          name: e.name,
          amount: inst.amount,
          due: inst.due,
          autoDeduction: false,
          category: 'essential',
        });
      }
    }

    for (const d of state.debts) {
      if (d.monthlyPayment <= 0) continue;
      items.push(...debtInstancesForMonth(d, year, monthIndex));
    }
  }

  const startToday = startOfLocalDay(ref).getTime();
  const overdueUnpaid: TimelineBill[] = [];
  const graceUnpaid: TimelineBill[] = [];
  const upcoming: TimelineBill[] = [];
  const { overdueGraceDays } = billReminderPrefs(state);

  for (const b of items) {
    if (billOccurrenceIsPaid(state, b)) continue;
    const dueT = startOfLocalDay(b.due).getTime();
    if (dueT < startToday) {
      if (calendarDaysAfterDue(ref, b.due) > overdueGraceDays) overdueUnpaid.push(b);
      else graceUnpaid.push(b);
    } else {
      upcoming.push(b);
    }
  }

  overdueUnpaid.sort((a, b) => a.due.getTime() - b.due.getTime());
  graceUnpaid.sort((a, b) => a.due.getTime() - b.due.getTime());
  upcoming.sort((a, b) => a.due.getTime() - b.due.getTime());

  return [...overdueUnpaid, ...graceUnpaid, ...upcoming];
};

/**
 * First unchecked line that is still **due today or later** (matches “next on the calendar”).
 * Old unpaid lines stay on the Bill calendar first, but do not replace this “forward” pick.
 */
export const nextBill = (state: FinanceState, ref = new Date()): TimelineBill | null => {
  const today = startOfLocalDay(ref).getTime();
  for (const b of buildTimeline(state, 4, ref)) {
    if (startOfLocalDay(b.due).getTime() >= today) return b;
  }
  return null;
};

/** Oldest unchecked line that is past due past your delay (timeline order). */
export function firstOverdueTimelineBill(state: FinanceState, ref = new Date()): TimelineBill | null {
  for (const b of buildTimeline(state, 4, ref)) {
    if (billVisualStatus(state, b, ref) === 'overdue') return b;
  }
  return null;
}

export type BillStatus = 'upcoming' | 'soon' | 'overdue' | 'paid';

/** True while still before / inside the household’s overdue delay (past calendar due, not WARNING yet). */
export function billIsInGraceAfterDue(state: FinanceState, b: TimelineBill, ref = new Date()): boolean {
  if (billOccurrenceIsPaid(state, b)) return false;
  const startToday = startOfLocalDay(ref).getTime();
  const dueT = startOfLocalDay(b.due).getTime();
  if (dueT >= startToday) return false;
  const { overdueGraceDays } = billReminderPrefs(state);
  return calendarDaysAfterDue(ref, b.due) <= overdueGraceDays;
}

export const billVisualStatus = (
  state: FinanceState,
  b: TimelineBill,
  ref = new Date(),
): BillStatus => {
  if (billOccurrenceIsPaid(state, b)) return 'paid';
  const { overdueGraceDays, upcomingLeadBusinessDays } = billReminderPrefs(state);

  const startToday = startOfLocalDay(ref).getTime();
  const dueT = startOfLocalDay(b.due).getTime();

  /** Calendar due date matches “today” — treat as overdue (reminders + UI). */
  if (dueT === startToday) return 'overdue';

  if (dueT < startToday) {
    if (calendarDaysAfterDue(ref, b.due) > overdueGraceDays) return 'overdue';
    return 'soon';
  }

  const bizSpan = businessWeekdaysFromTomorrowThroughDueInclusive(ref, b.due);
  if (bizSpan > 0 && bizSpan <= upcomingLeadBusinessDays) return 'soon';
  return 'upcoming';
};

/** Sum of timeline bills in the next `withinDays` days that are not marked paid */
export const upcomingDeductionsTotal = (
  state: FinanceState,
  withinDays: number,
  ref = new Date(),
): number => {
  const startToday = startOfLocalDay(ref).getTime();
  const end = startToday + withinDays * 24 * 60 * 60 * 1000;
  return buildTimeline(state, 2, ref)
    .filter((b) => {
      const t = b.due.getTime();
      if (t < startToday || t > end) return false;
      return !billOccurrenceIsPaid(state, b);
    })
    .reduce((s, b) => s + b.amount, 0);
};

/** Everything scheduled in one calendar month — used for review counts, missed list, and totals. */
export function timelineOccurrencesDueInCalendarMonth(
  state: FinanceState,
  monthKey: string,
): TimelineBill[] {
  if (monthKey < HISTORY_TRACKING_STARTED_MONTH_KEY) return [];
  const p = parseCalendarMonthKey(monthKey);
  if (!p) return [];
  const { year, monthIndex } = p;
  const items: TimelineBill[] = [];
  for (const e of state.essentials) {
    for (const inst of essentialInstancesForMonth(e, year, monthIndex)) {
      items.push({
        id: `${e.id}-${monthKey}-${inst.due.toISOString()}`,
        billId: e.id,
        name: e.name,
        amount: inst.amount,
        due: inst.due,
        autoDeduction: false,
        category: 'essential',
      });
    }
  }
  for (const d of state.debts) {
    if (d.monthlyPayment <= 0) continue;
    items.push(...debtInstancesForMonth(d, year, monthIndex));
  }
  items.sort((a, b) => a.due.getTime() - b.due.getTime());
  return items;
}

export function billsHandledBreakdownForMonth(
  state: FinanceState,
  monthKey: string,
): { handled: number; total: number; missed: TimelineBill[] } {
  const occ = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  const missed: TimelineBill[] = [];
  let handled = 0;
  for (const b of occ) {
    if (billOccurrenceIsPaid(state, b)) handled += 1;
    else missed.push(b);
  }
  return { handled, total: occ.length, missed };
}

export const billsPaidThisMonthCount = (state: FinanceState, ref = new Date()): number => {
  if (dateToMonthKey(ref) < HISTORY_TRACKING_STARTED_MONTH_KEY) return 0;
  const year = ref.getFullYear();
  const monthIndex = ref.getMonth();
  let n = 0;

  for (const e of state.essentials) {
    for (const inst of essentialInstancesForMonth(e, year, monthIndex)) {
      if (
        billOccurrenceIsPaid(state, {
          billId: e.id,
          due: inst.due,
          category: 'essential',
        })
      )
        n += 1;
    }
  }

  for (const d of state.debts) {
    if (d.monthlyPayment <= 0) continue;
    for (const b of debtInstancesForMonth(d, year, monthIndex)) {
      if (billOccurrenceIsPaid(state, b)) n += 1;
    }
  }

  return n;
};

export const availableForBillsHint = (state: FinanceState): number => {
  const br = allocationBreakdown(state);
  return Math.max(0, br.income - br.essentials - br.groceries - br.debt - br.savings + state.emergencyFund * 0);
};
