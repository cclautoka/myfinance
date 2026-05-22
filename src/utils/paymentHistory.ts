import {
  calendarMonthKeyMinusMonths,
  dateToMonthKey,
  HISTORY_TRACKING_STARTED_MONTH_KEY,
} from '../data/defaults';
import type { FinanceState } from '../types/finance';
import {
  billOccurrenceIsPaid,
  billOccurrencePaidDisplayAmount,
  timelineOccurrencesDueInCalendarMonth,
} from './billsTimeline';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type LifetimePaidBillRow = {
  billId: string;
  name: string;
  category: 'essential' | 'debt' | 'other';
  total: number;
  paidOccurrences: number;
  /** Due date of the most recent paid occurrence (ISO yyyy-mm-dd). */
  lastPaidDate: string | null;
};

export type LifeSpendKind = 'bill' | 'surprise';

export type LifetimeLifeSpendRow = {
  id: string;
  name: string;
  kind: LifeSpendKind;
  total: number;
  paidOccurrences: number;
  lastPaidDate: string | null;
  category?: 'essential' | 'debt' | 'other';
};

/** Calendar months from first tracked month through `ref`’s calendar month (inclusive). */
export function trackingMonthKeysThrough(ref = new Date()): string[] {
  const end = dateToMonthKey(ref);
  const keys: string[] = [];
  let mk: string | null = HISTORY_TRACKING_STARTED_MONTH_KEY;
  while (mk && mk <= end) {
    keys.push(mk);
    mk = calendarMonthKeyMinusMonths(mk, 1);
  }
  return keys;
}

/**
 * Total dollars marked handled on the bill calendar per `billId`, from tracking start through `ref`’s month.
 * Uses the same paid keys and amounts as cashflow (`billOccurrencePaidDisplayAmount`).
 */
export function lifetimePaidByBill(state: FinanceState, ref = new Date()): LifetimePaidBillRow[] {
  const byId = new Map<
    string,
    {
      name: string;
      category: 'essential' | 'debt' | 'other';
      total: number;
      paidOccurrences: number;
      lastDueMs: number;
    }
  >();

  for (const monthKey of trackingMonthKeysThrough(ref)) {
    const occ = timelineOccurrencesDueInCalendarMonth(state, monthKey);
    for (const b of occ) {
      if (!billOccurrenceIsPaid(state, b)) continue;
      const amt = round2(billOccurrencePaidDisplayAmount(state, b, b.amount));
      const dueMs = b.due.getTime();
      const cur = byId.get(b.billId);
      if (!cur) {
        byId.set(b.billId, {
          name: b.name,
          category: b.category,
          total: amt,
          paidOccurrences: 1,
          lastDueMs: dueMs,
        });
      } else {
        cur.total = round2(cur.total + amt);
        cur.paidOccurrences += 1;
        if (dueMs > cur.lastDueMs) {
          cur.lastDueMs = dueMs;
          cur.name = b.name;
        }
      }
    }
  }

  return [...byId.entries()]
    .map(([billId, v]) => ({
      billId,
      name: v.name,
      category: v.category,
      total: v.total,
      paidOccurrences: v.paidOccurrences,
      lastPaidDate: v.lastDueMs > 0 ? new Date(v.lastDueMs).toISOString().slice(0, 10) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

function expenseMonthKey(dateIso: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(dateIso.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

/** Unexpected expenses logged since tracking started (one aggregated bar). */
export function lifetimeSurpriseSpend(state: FinanceState): LifetimeLifeSpendRow[] {
  const entries = state.surpriseExpenses.filter((e) => {
    const mk = expenseMonthKey(e.date);
    return mk != null && mk >= HISTORY_TRACKING_STARTED_MONTH_KEY;
  });
  if (entries.length === 0) return [];

  const total = round2(entries.reduce((sum, e) => sum + e.amount, 0));
  const lastPaidDate = entries.reduce<string | null>((latest, e) => {
    if (!latest || e.date > latest) return e.date;
    return latest;
  }, null);

  return [
    {
      id: 'surprise-aggregate',
      name: 'Unexpected Expense',
      kind: 'surprise' as const,
      total,
      paidOccurrences: entries.length,
      lastPaidDate,
    },
  ];
}

/** Bills marked handled + unexpected expenses for the lifetime chart. */
export function lifetimeLifeSpendRows(state: FinanceState, ref = new Date()): LifetimeLifeSpendRow[] {
  const bills: LifetimeLifeSpendRow[] = lifetimePaidByBill(state, ref).map((r) => ({
    id: r.billId,
    name: r.name,
    kind: 'bill' as const,
    total: r.total,
    paidOccurrences: r.paidOccurrences,
    lastPaidDate: r.lastPaidDate,
    category: r.category,
  }));
  return [...bills, ...lifetimeSurpriseSpend(state)].sort((a, b) => b.total - a.total);
}
