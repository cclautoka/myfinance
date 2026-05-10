import type { FinanceState } from '../types/finance';
import { allocationBreakdown } from './allocation';
import { upcomingDeductionsTotal } from './billsTimeline';
import { combinedMonthlyIncome } from './calculations';

export interface SafeSpendResult {
  monthlyFlex: number;
  weeklyHint: number;
  afterUpcomingWindow: number;
  windowDays: number;
}

/**
 * Household “flex” after planned % buckets; wallets are guilt‑free on top.
 * Subtracts unpaid bills coming due within `windowDays` as a gentle guardrail.
 */
export const computeSafeSpend = (
  state: FinanceState,
  windowDays = 14,
  ref = new Date(),
): SafeSpendResult => {
  const { remainder } = allocationBreakdown(state);
  const upcoming = upcomingDeductionsTotal(state, windowDays, ref);
  const income = combinedMonthlyIncome(state);
  const monthlyFlex = remainder + (state.wallets.husbandBudget + state.wallets.wifeBudget) * 0;
  const afterUpcoming = Math.max(0, monthlyFlex - Math.max(0, upcoming - income * 0.05));
  const weeklyHint = afterUpcoming / 4.33;
  return {
    monthlyFlex: Math.max(0, monthlyFlex),
    weeklyHint: Math.max(0, weeklyHint),
    afterUpcomingWindow: Math.max(0, afterUpcoming),
    windowDays,
  };
};
