import { useCallback, useMemo } from 'react';
import { BillsTimeline } from '../components/BillsTimeline';
import { DashboardOverview } from '../components/DashboardOverview';
import { UpcomingBillsStrip } from '../components/UpcomingBillsStrip';
import { buildDemoFinanceState } from './demoFinanceState';

/** Public landing demo — same dashboard pieces as the signed-in app (scaled in the device frame). */
export function LandingDashboardDemo() {
  const state = useMemo(() => buildDemoFinanceState(), []);
  const noopToggle = useCallback(() => {}, []);

  return (
    <div className="space-y-3 p-2">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300/90">
        Dashboard · live month
      </p>
      <p className="text-center text-[11px] leading-snug text-slate-600 dark:text-moss-muted">
        Snapshot in the centre on large screens · upcoming and bill calendar on the sides.
      </p>

      <UpcomingBillsStrip state={state} />

      <BillsTimeline state={state} onTogglePaid={noopToggle} />

      <DashboardOverview state={state} variant="preview" />

      <details
        open
        className="rounded-xl border border-slate-200/80 bg-white/80 dark:border-moss-border dark:bg-moss-surface/60"
      >
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-slate-800 marker:content-none dark:text-moss-fg [&::-webkit-details-marker]:hidden">
          More this month (snowball, surplus, pay)
        </summary>
        <p className="border-t border-slate-200/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-moss-border dark:text-moss-muted">
          Lifetime pay chart, debt snowball, budget surplus, and the paycheque log — same accordion as the app.
        </p>
      </details>
    </div>
  );
}
