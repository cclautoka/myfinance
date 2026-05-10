import type { FinanceState } from '../types/finance';
import { formatCalendarMonthHeading } from '../data/defaults';
import {
  formatTrackingStartedHeading,
  historyMonthLooksEmpty,
  isPreTrackingHistoryMonth,
} from '../utils/historyMonth';

export function HistoryMonthBanner({
  state,
  monthKey,
}: {
  state: FinanceState;
  monthKey: string;
}) {
  const pre = isPreTrackingHistoryMonth(monthKey);
  const empty = historyMonthLooksEmpty(state, monthKey);
  if (!pre && !empty) return null;

  const label = formatCalendarMonthHeading(monthKey);

  return (
    <section
      className="rounded-2xl border border-dashed border-sage-300/90 bg-sage-50/60 px-4 py-3 text-sm leading-relaxed text-sage-800 dark:border-moss-border dark:bg-moss-surface/70 dark:text-moss-subtle"
      aria-live="polite"
    >
      {pre ? (
        <p>
          <strong className="text-sage-900 dark:text-moss-fg">No saved history for {label}</strong> in this app —
          tracking started {formatTrackingStartedHeading()}. This month is here as a placeholder; the dashboard and “this month”
          sections above always follow today&apos;s calendar.
        </p>
      ) : (
        <p>
          <strong className="text-sage-900 dark:text-moss-fg">{label}</strong> has nothing recorded yet: no paycheque log dated
          this month, no extras or surprises with these dates, and no bill checklist lines whose due falls in this month.
        </p>
      )}
    </section>
  );
}
