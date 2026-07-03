import type { FinanceState, TimelineBill } from '../types/finance';
import { currentMonthKey, parseCalendarMonthKey, previousCalendarMonthKey } from '../data/defaults';
import { billOccurrenceIsPaid, timelineOccurrencesDueInCalendarMonth } from './billsTimeline';
import { extraIncomeMonthTotal, surpriseExpensesMonthTotal } from './calculations';
import { incomeLogMonthTotal } from './incomeLog';

/** Any real workbook use beyond static Household numbers — gates month-opening nag. */
export function hasMeaningfulFinanceTouch(state: FinanceState): boolean {
  if (state.incomeLog.length > 0) return true;
  if (state.extraIncome.length > 0) return true;
  if (state.surpriseExpenses.length > 0) return true;
  if ((state.budgetSurplusSweeps ?? []).length > 0) return true;
  for (const arr of Object.values(state.billsPaid)) {
    if (arr && arr.length > 0) return true;
  }
  return false;
}

/** Prior calendar month had real workbook activity worth settling at month open. */
export function priorMonthHadMeaningfulTouch(state: FinanceState, priorMonthKey: string): boolean {
  if (incomeLogMonthTotal(state, priorMonthKey) > 0) return true;
  if (extraIncomeMonthTotal(state, priorMonthKey) > 0) return true;
  if (surpriseExpensesMonthTotal(state, priorMonthKey) > 0) return true;
  if ((state.budgetSurplusSweeps ?? []).some((e) => e.monthKey === priorMonthKey)) return true;
  const occ = timelineOccurrencesDueInCalendarMonth(state, priorMonthKey);
  return occ.some((b) => billOccurrenceIsPaid(state, b));
}

/** Block the rest of the app until today's calendar month has an opening seal. */
export function requiresMonthCashflowOpening(state: FinanceState): boolean {
  const mk = currentMonthKey();
  const opening = state.monthCashflowOpening?.[mk];
  if (opening && !opening.migrated) return false;
  if (!hasMeaningfulFinanceTouch(state)) return false;
  const prev = previousCalendarMonthKey(mk);
  if (!priorMonthHadMeaningfulTouch(state, prev)) return false;
  return true;
}

/**
 * Bills in `monthKey` due on/before `lastDayInclusive` (e.g. 10 = watch first ten calendar days early pay).
 */
export function billsDueInFirstDaysOfMonth(
  state: FinanceState,
  monthKey: string,
  lastDayInclusive: number,
): TimelineBill[] {
  const p = parseCalendarMonthKey(monthKey);
  if (!p) return [];
  const dom = Math.min(Math.max(1, lastDayInclusive), 31);
  const occ = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  const end = new Date(p.year, p.monthIndex, dom, 23, 59, 59, 999);
  return occ.filter((b) => b.due.getTime() <= end.getTime()).sort((a, b) => a.due.getTime() - b.due.getTime());
}
