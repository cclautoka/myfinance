import { useMemo } from 'react';
import type { FinanceState, TimelineBill } from '../types/finance';
import { bills as billsCopy } from '../copy/bills';
import { billsTimelineTip } from '../copy/tooltips';
import type { BillsPaidTogglePayload } from '../utils/billsTimeline';
import {
  availableForBillsHint,
  billIsInGraceAfterDue,
  billOccurrenceIsPaid,
  billOccurrencePaidDisplayAmount,
  billVisualStatus,
  buildTimeline,
  upcomingDeductionsTotal,
} from '../utils/billsTimeline';
import { businessWeekdaysFromTomorrowThroughDueInclusive } from '../utils/businessDays';
import { formatMoney, formatShortDate } from '../utils/format';
import { BillPaymentMarkControls } from './BillPaymentMarkControls';
import { Card } from './ui/Card';
import { InfoTipButton } from './ui/InfoTipButton';

const chipTone = (
  status: ReturnType<typeof billVisualStatus>,
  inGrace: boolean,
) => {
  if (status === 'paid') return 'bg-sage-200/70 text-sage-800 dark:bg-moss-primary/20 dark:text-moss-tip';
  if (status === 'overdue')
    return 'bg-red-700 text-white shadow-sm dark:bg-red-600 dark:text-white';
  if (status === 'soon') {
    if (inGrace)
      return 'border border-amber-300/90 bg-amber-100/95 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-100';
    return 'border border-amber-200/90 bg-amber-50/95 text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/25 dark:text-amber-100';
  }
  return 'bg-white text-sage-800 ring-1 ring-sage-200/80 dark:bg-moss-bg dark:text-moss-subtle dark:ring-moss-border';
};

const rowWrap = (status: ReturnType<typeof billVisualStatus>, inGrace: boolean) => {
  if (status === 'paid')
    return 'border border-sage-200/80 bg-white/90 dark:border-moss-border dark:bg-moss-surface';
  if (status === 'overdue')
    return 'border-2 border-red-600 bg-red-50/98 shadow-md dark:border-red-500 dark:bg-red-950/45 dark:shadow-red-950/20';
  if (status === 'soon') {
    if (inGrace)
      return 'border border-amber-300/80 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20';
    return 'border border-amber-200/70 bg-white/95 dark:border-amber-900/30 dark:bg-moss-surface/90';
  }
  return 'border border-sage-200/80 bg-white/90 dark:border-moss-border dark:bg-moss-surface';
};

function chipLabel(state: FinanceState, b: TimelineBill, status: ReturnType<typeof billVisualStatus>): string {
  if (status === 'paid') return billsCopy.statusPaid;
  if (status === 'overdue') return billsCopy.statusOverdue;
  if (status === 'soon') {
    if (billIsInGraceAfterDue(state, b)) return billsCopy.statusGrace;
    const n = businessWeekdaysFromTomorrowThroughDueInclusive(new Date(), b.due);
    return billsCopy.statusDueSoon(n);
  }
  return billsCopy.statusUpcoming;
}

export function BillsTimeline({
  state,
  onTogglePaid,
}: {
  state: FinanceState;
  onTogglePaid: (row: BillsPaidTogglePayload) => void;
}) {
  const rows = useMemo(() => buildTimeline(state, 3), [state]);
  const hint = availableForBillsHint(state);
  const upcoming10 = upcomingDeductionsTotal(state, 10);
  const tight = upcoming10 > hint * 0.85 && upcoming10 > 0;

  const overdueCount = useMemo(
    () =>
      rows.reduce(
        (n, b) => n + (!billOccurrenceIsPaid(state, b) && billVisualStatus(state, b) === 'overdue' ? 1 : 0),
        0,
      ),
    [rows, state],
  );

  return (
    <div id="bills-timeline" data-tour="tour-bills-checklist" className="min-h-0 min-w-0">
      <div className="min-h-0 min-w-0">
        <Card
          accent="teal"
          className="min-w-0"
          title={billsCopy.calendarTitle}
          subtitle={billsCopy.calendarSubtitle}
          titleAside={
            <InfoTipButton content={billsTimelineTip()} />
          }
        >
            {overdueCount > 0 && (
              <div
                role="alert"
                className="mb-4 min-w-0 max-w-full break-words rounded-xl border-2 border-red-600 bg-red-600 px-4 py-4 text-white shadow-lg dark:border-red-500 dark:bg-red-700"
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em]">Overdue</p>
                <p className="mt-2 text-sm font-semibold leading-snug">
                  {billsCopy.overdueBanner(overdueCount)} Check dates under Your income &amp; regular bills if something looks wrong.
                </p>
              </div>
            )}

            {tight && (
              <div className="mb-4 min-w-0 max-w-full break-words rounded-xl border border-sage-200/90 bg-sage-50/90 p-4 text-sm text-sage-800 dark:border-moss-border dark:bg-moss-surface dark:text-moss-subtle">
                {billsCopy.cushionTight(formatMoney(upcoming10), formatMoney(hint))}
              </div>
            )}

            <ul className="min-w-0 space-y-3">
              {rows.slice(0, 18).map((b) => {
                const status = billVisualStatus(state, b);
                const inGrace = billIsInGraceAfterDue(state, b);
                const isChecked = billOccurrenceIsPaid(state, b);
                const displayPaid = billOccurrencePaidDisplayAmount(state, b, b.amount);
                const toggleTarget = {
                  billId: b.billId,
                  due: b.due,
                  category: b.category,
                  label: b.name,
                };
                return (
                  <li
                    key={b.id}
                    className={`flex min-w-0 max-w-full flex-col gap-3 rounded-xl p-4 ${rowWrap(status, inGrace)}`}
                  >
                    <div className="min-w-0 w-full max-w-full">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 max-w-full break-words font-medium text-sage-900 dark:text-moss-fg">{b.name}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipTone(status, inGrace)}`}>
                          {chipLabel(state, b, status)}
                        </span>
                        {b.autoDeduction && (
                          <span className="rounded-full bg-sage-200/80 px-2 py-0.5 text-xs text-sage-800 dark:bg-moss-bg dark:text-moss-muted">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-sage-600 dark:text-moss-muted">
                        {formatShortDate(b.due)} · Plan {formatMoney(b.amount)}
                      </p>
                    </div>
                    <div className="w-full min-w-0 border-t border-sage-200/60 pt-3 dark:border-moss-border/80">
                      <BillPaymentMarkControls
                        occurrenceKey={b.id}
                        toggleTarget={toggleTarget}
                        plannedAmount={b.amount}
                        isPaid={isChecked}
                        displayPaidAmount={displayPaid}
                        onToggle={onTogglePaid}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
        </Card>
      </div>
    </div>
  );
}
