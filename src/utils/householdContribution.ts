import { currentMonthKey } from '../data/defaults';
import type { FinanceState } from '../types/finance';
import {
  billOccurrenceIsPaid,
  billOccurrencePaidDisplayAmount,
  billPaymentKey,
  timelineOccurrencesDueInCalendarMonth,
} from './billsTimeline';

export type ContributorKey = 'owner' | 'partner' | 'unknown';

export type ContributorMonthStats = {
  key: ContributorKey;
  label: string;
  count: number;
  dollars: number;
};

function contributorKeyFromRole(role: string | undefined): ContributorKey {
  if (role === 'owner') return 'owner';
  if (role === 'partner') return 'partner';
  return 'unknown';
}

function contributorLabel(key: ContributorKey): string {
  if (key === 'owner') return 'Primary';
  if (key === 'partner') return 'Partner';
  return 'Unknown';
}

/** Bills marked handled this calendar month, grouped by Primary / Partner / Unknown. */
export function monthBillContributionStats(
  state: FinanceState,
  monthKey: string = currentMonthKey(),
): ContributorMonthStats[] {
  const timeline = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  const buckets: Record<ContributorKey, { count: number; dollars: number }> = {
    owner: { count: 0, dollars: 0 },
    partner: { count: 0, dollars: 0 },
    unknown: { count: 0, dollars: 0 },
  };

  for (const row of timeline) {
    const payKey = billPaymentKey(state, row);
    if (!billOccurrenceIsPaid(state, row)) continue;

    const attr = state.billPaymentAttribution?.[row.billId]?.[payKey];
    const key = contributorKeyFromRole(attr?.role);
    buckets[key].count += 1;
    buckets[key].dollars += billOccurrencePaidDisplayAmount(state, row, row.amount);
  }

  const order: ContributorKey[] = ['owner', 'partner', 'unknown'];
  return order
    .map((key) => ({
      key,
      label: contributorLabel(key),
      count: buckets[key].count,
      dollars: Math.round(buckets[key].dollars * 100) / 100,
    }))
    .filter((r) => r.count > 0 || r.key === 'owner' || r.key === 'partner');
}
