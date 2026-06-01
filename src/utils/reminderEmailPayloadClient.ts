/**
 * Bills heads-up for save emails — classification must stay aligned with
 * `server/reminders.mjs` (grace days, business-day lead, tracking start month).
 */
import type { FinanceState, TimelineBill } from '../types/finance';
import { buildTimeline, billOccurrenceIsPaid, billVisualStatus } from './billsTimeline';
import { startOfLocalDay } from './businessDays';
import { formatMoney } from './format';
import type { DigestSection, DigestListItem } from './financeStateDiff';

const MS_DAY = 86400_000;

/** Unpaid bills due within this many calendar days from today (and not already “soon”). */
export const SAVE_EMAIL_BILL_HORIZON_CALENDAR_DAYS = 14;

function formatDueIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function metaForBill(state: FinanceState, b: TimelineBill, ref: Date): string {
  const bits: string[] = [];
  bits.push(b.category === 'debt' ? 'Debt' : 'Essential');
  if (b.autoDeduction) bits.push('Auto');
  const startToday = startOfLocalDay(ref).getTime();
  const dueT = startOfLocalDay(b.due).getTime();
  const st = billVisualStatus(state, b, ref);
  if (dueT === startToday && st === 'overdue') bits.push('Due today');
  else if (dueT < startToday && st === 'soon') bits.push('Past due (grace)');
  return bits.join(' · ');
}

function rowToItem(state: FinanceState, b: TimelineBill, ref: Date): DigestListItem {
  return {
    title: `${b.name} — ${formatMoney(b.amount)}`,
    body: `Due ${formatDueIso(b.due)}`,
    meta: metaForBill(state, b, ref),
  };
}

/** Build three sections: due soon (incl. grace), overdue, on the horizon (14d). */
export function buildBillsHeadsUpSections(state: FinanceState, ref = new Date()): DigestSection[] {
  const dueSoon: DigestListItem[] = [];
  const overdue: DigestListItem[] = [];
  const horizon: DigestListItem[] = [];

  const startToday = startOfLocalDay(ref).getTime();
  const horizonEnd = startToday + SAVE_EMAIL_BILL_HORIZON_CALENDAR_DAYS * MS_DAY;

  for (const b of buildTimeline(state, 2, ref)) {
    if (billOccurrenceIsPaid(state, b)) continue;
    const st = billVisualStatus(state, b, ref);
    const dueT = startOfLocalDay(b.due).getTime();

    if (st === 'soon') {
      dueSoon.push(rowToItem(state, b, ref));
      continue;
    }
    if (st === 'overdue') {
      overdue.push({
        ...rowToItem(state, b, ref),
        body: `Was due ${formatDueIso(b.due)}`,
      });
      continue;
    }
    if (st === 'upcoming' && dueT >= startToday && dueT <= horizonEnd) {
      horizon.push(rowToItem(state, b, ref));
    }
  }

  const sortKey = (x: DigestListItem) => x.body ?? '';
  dueSoon.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  overdue.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  horizon.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return [
    { heading: 'Due soon (includes grace)', items: dueSoon },
    { heading: 'Overdue', items: overdue },
    { heading: `Coming up (next ${SAVE_EMAIL_BILL_HORIZON_CALENDAR_DAYS} days)`, items: horizon },
  ];
}
