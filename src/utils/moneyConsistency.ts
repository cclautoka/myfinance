import type { FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { pocketLeftSoFar } from './budgetSurplus';
import { upcomingDeductionsTotal } from './billsTimeline';
import { monthIncomeSpendSummary } from './householdIncomeSpend';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Weeks left in the calendar month (includes today), minimum 1. */
export function weeksRemainingInMonth(ref: Date = new Date()): number {
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - ref.getDate() + 1;
  return Math.max(1, daysLeft / 7);
}

/** Bill calendar heads-up: next N days unpaid vs Left from deposits. */
export function billCalendarHeadsUp(
  state: FinanceState,
  withinDays = 10,
  ref: Date = new Date(),
): { upcomingTotal: number; pocketLeft: number; tight: boolean } {
  const mk = currentMonthKey();
  const upcomingTotal = upcomingDeductionsTotal(state, withinDays, ref);
  const pocketLeft = pocketLeftSoFar(state, mk, ref);
  const tight = upcomingTotal > 0 && upcomingTotal > Math.max(0, pocketLeft);
  return { upcomingTotal, pocketLeft, tight };
}

/** Primary row remaining should match household pocket when sole depositor. */
export function solePrimaryPocketMatchesChart(state: FinanceState, monthKey: string, ref: Date = new Date()): boolean {
  const summary = monthIncomeSpendSummary(state, monthKey);
  const pocket = pocketLeftSoFar(state, monthKey, ref);
  const primary = summary.rows.find((r) => r.key === 'owner');
  const partner = summary.rows.find((r) => r.key === 'partner');
  const extra = summary.rows.find((r) => r.key === 'extra');
  const sole =
    (partner?.incomeLogged ?? 0) <= 0 &&
    (extra?.incomeLogged ?? 0) <= 0 &&
    !summary.rows.some((r) => r.key === 'joint' && r.incomeLogged > 0);
  if (!sole || !primary) return true;
  return round2(primary.remaining) === round2(pocket);
}
