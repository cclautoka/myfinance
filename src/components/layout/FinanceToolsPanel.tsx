import type { FinanceState } from '../../types/finance';
import { AppNotificationsPanel } from '../AppNotificationsPanel';
import { NotifyRelaySettings } from '../NotifyRelaySettings';

type ReloadResult = { ok: true; updatedAt: string } | { ok: false; error: string };

export function FinanceToolsPanel({
  state,
  onPatch,
  onReloadFromServer,
  onReplayTour,
  onRequestReset,
}: {
  state: FinanceState;
  onPatch: (patch: Partial<FinanceState>) => void;
  onReloadFromServer: () => Promise<ReloadResult>;
  onReplayTour: () => void;
  onRequestReset: () => void;
}) {
  return (
    <div id="finance-manage" data-tour="tour-manage" className="space-y-8">
      <section aria-labelledby="tools-household-heading" className="space-y-3">
        <h3 id="tools-household-heading" className="font-display text-base font-bold text-sage-900 dark:text-moss-fg">
          Household &amp; sync
        </h3>
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">
          Notifications, export, and server sync. Charts and the bill checklist live on the{' '}
          <strong className="text-sage-900 dark:text-moss-fg">Dashboard</strong> tab; paycheque automation is under{' '}
          <strong className="text-sage-900 dark:text-moss-fg">Your numbers</strong>.
        </p>
        <AppNotificationsPanel state={state} onPatch={onPatch} />
        <NotifyRelaySettings state={state} onReloadFromServer={onReloadFromServer} />
      </section>
      <section
        aria-labelledby="tools-danger-heading"
        className="rounded-xl border border-red-300/60 bg-red-50/40 p-5 dark:border-red-900/45 dark:bg-red-950/25"
      >
        <h3 id="tools-danger-heading" className="font-display text-base font-bold text-red-900 dark:text-red-200">
          Danger zone
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-sage-800 dark:text-moss-subtle">
          Saved only on this device unless server storage is on. Clearing site data wipes local copies — export CSV from Past
          months first if you care.
        </p>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" onClick={onReplayTour}>
              Replay tour
            </button>
            <button type="button" className="btn-secondary btn-secondary-sm font-bold" onClick={onRequestReset}>
              Reset to blank worksheet
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
