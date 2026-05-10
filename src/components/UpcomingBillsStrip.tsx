import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { upcomingStripTip } from '../copy/tooltips';
import {
  billIsInGraceAfterDue,
  billOccurrenceIsPaid,
  billVisualStatus,
  buildTimeline,
} from '../utils/billsTimeline';
import { formatMoney, formatShortDate } from '../utils/format';
import { HoverTip } from './ui/HoverTip';

function rowClass(st: ReturnType<typeof billVisualStatus>, inGrace: boolean) {
  if (st === 'overdue')
    return 'rounded-lg border border-red-500/90 bg-red-50/90 px-3 py-2 dark:border-red-500/60 dark:bg-red-950/35';
  if (st === 'soon')
    return `rounded-lg border px-3 py-2 ${
      inGrace
        ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/25'
        : 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/15'
    }`;
  return '';
}

export function UpcomingBillsStrip({
  state,
  onOpenTimeline,
}: {
  state: FinanceState;
  onOpenTimeline?: () => void;
}) {
  const rows = useMemo(() => buildTimeline(state, 2), [state]);
  const next = useMemo(() => {
    const out: typeof rows = [];
    for (const b of rows) {
      if (billOccurrenceIsPaid(state, b)) continue;
      out.push(b);
      if (out.length >= 5) break;
    }
    return out;
  }, [rows, state]);

  const overdueAhead = useMemo(
    () =>
      next.filter(
        (b) => billVisualStatus(state, b) === 'overdue' || billIsInGraceAfterDue(state, b),
      ).length,
    [next, state],
  );

  const inner =
    next.length === 0 ? (
      <div className="min-w-0 max-w-full rounded-2xl border border-sage-300/80 bg-sage-50/90 px-4 py-4 dark:border-moss-border dark:bg-moss-surface">
        <p className="text-sm font-bold text-sage-900 dark:text-moss-subtle">
          Nothing due soon in the window we look at — add bills under Your income & regular bills if dates are missing.
        </p>
      </div>
    ) : (
      <div className="min-w-0 max-w-full rounded-2xl border border-sage-300/90 bg-sage-50/95 px-4 py-4 shadow-sm dark:border-moss-accent/25 dark:bg-moss-surface dark:shadow-none">
        {overdueAhead > 0 && (
          <div
            role="status"
            className="mb-4 min-w-0 max-w-full break-words rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <p className="font-semibold uppercase tracking-wide text-[11px] text-amber-900 dark:text-amber-200/90">
              Attention
            </p>
            <p className="mt-1.5 leading-snug">
              {next.some((b) => billVisualStatus(state, b) === 'overdue') ? (
                <>
                  At least one line is{' '}
                  <span className="font-bold text-red-700 dark:text-red-400">overdue</span> past your delay setting — open the full
                  timeline to clear it.
                </>
              ) : (
                <>
                  Some lines are past the calendar date but still inside your overdue delay — soft heads-up before they turn red.
                </>
              )}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sage-200/80 pb-3 dark:border-moss-border">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sage-800 dark:text-moss-muted">
              Next bills
            </p>
            <p className="mt-0.5 text-sm font-semibold text-sage-800 dark:text-moss-subtle">
              Skips anything you already marked paid. Hover for timing rules.
            </p>
          </div>
          {onOpenTimeline && (
            <button type="button" onClick={onOpenTimeline} className="btn-primary px-4 py-2 text-xs">
              Full timeline
            </button>
          )}
        </div>
        <ul className="mt-3 divide-y divide-sage-200/80 dark:divide-moss-border">
          {next.map((b) => {
            const st = billVisualStatus(state, b);
            const inGrace = billIsInGraceAfterDue(state, b);
            const extra =
              st === 'soon' && !inGrace
                ? ' · Closing in (business days)'
                : st === 'soon' && inGrace
                  ? ' · Delay window'
                  : st === 'overdue'
                    ? ' · Overdue'
                    : '';
            return (
              <li
                key={b.id}
                className={`flex min-w-0 flex-wrap items-start justify-between gap-2 py-3 first:pt-0 ${rowClass(st, inGrace)}`}
              >
                <div className="min-w-0 max-w-full flex-1">
                  <p className="break-words font-semibold text-sage-900 dark:text-moss-fg">{b.name}</p>
                  <p className="break-words text-xs text-sage-600 dark:text-moss-muted">
                    {formatShortDate(b.due)}
                    {b.autoDeduction ? ' · Auto deduction' : ''}
                    {extra}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-bold tabular-nums text-sage-900 dark:text-moss-fg">
                  {formatMoney(b.amount)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <HoverTip content={upcomingStripTip()} className="flex min-h-0 min-w-0 flex-col">
      <div className="min-h-0 min-w-0">{inner}</div>
    </HoverTip>
  );
}
