import type { FinanceState } from '../types/finance';
import {
  HISTORY_TRACKING_STARTED_MONTH_KEY,
  formatCalendarMonthHeading,
} from '../data/defaults';
import { extraIncomeMonthTotal, surpriseExpensesMonthTotal } from './calculations';
import { billsHandledBreakdownForMonth } from './billsTimeline';
import { incomeLogMonthTotal } from './incomeLog';

export const isPreTrackingHistoryMonth = (monthKey: string): boolean =>
  monthKey < HISTORY_TRACKING_STARTED_MONTH_KEY;

/** True when nothing user-facing would normally fill this bucket (vs scheduled bill lines alone). */
export function historyMonthLooksEmpty(state: FinanceState, monthKey: string): boolean {
  if (incomeLogMonthTotal(state, monthKey) > 0) return false;
  if (extraIncomeMonthTotal(state, monthKey) > 0) return false;
  if (surpriseExpensesMonthTotal(state, monthKey) > 0) return false;
  const bills = billsHandledBreakdownForMonth(state, monthKey);
  if (bills.handled > 0 || bills.missed.length > 0) return false;
  return true;
}

export function formatTrackingStartedHeading(): string {
  return formatCalendarMonthHeading(HISTORY_TRACKING_STARTED_MONTH_KEY);
}
