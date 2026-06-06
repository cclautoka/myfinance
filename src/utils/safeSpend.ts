import type { FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { pocketLeftSoFar } from './budgetSurplus';
import { upcomingDeductionsTotal } from './billsTimeline';
import { weeksRemainingInMonth } from './moneyConsistency';

export interface SafeSpendResult {
  /** Left from deposits after bills due so far (same as Dashboard tile). */
  monthlyFlex: number;
  /** Pocket left after near-term unpaid bills, spread over weeks left this month. */
  weeklyHint: number;
  /** Pocket minus unpaid bills due within the window. */
  afterUpcomingWindow: number;
  windowDays: number;
}

/**
 * Weekly discretionary hint from **actual cash** (Left from deposits), not the monthly plan.
 * Subtracts unpaid bills due within `windowDays`, then spreads the remainder over weeks left.
 */
export const computeSafeSpend = (
  state: FinanceState,
  windowDays = 14,
  ref = new Date(),
): SafeSpendResult => {
  const mk = currentMonthKey();
  const pocketLeft = pocketLeftSoFar(state, mk, ref);
  const upcoming = upcomingDeductionsTotal(state, windowDays, ref);
  const afterUpcoming = Math.max(0, pocketLeft - upcoming);
  const weeksLeft = weeksRemainingInMonth(ref);
  const weeklyHint = afterUpcoming / weeksLeft;
  return {
    monthlyFlex: Math.max(0, pocketLeft),
    weeklyHint: Math.max(0, weeklyHint),
    afterUpcomingWindow: Math.max(0, afterUpcoming),
    windowDays,
  };
};
