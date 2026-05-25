import type { ReactNode } from 'react';
import { SEGMENTED_TRACK_CLASS, segmentedTriggerClass } from '../ui/segmentedSurface';

export type ToolsTab = 'sync' | 'audit';

export type ToolsTabSelection = ToolsTab | null;

const TAB_DEF: { id: ToolsTab; label: string }[] = [
  { id: 'sync', label: 'Sync & alerts' },
  { id: 'audit', label: 'Audit' },
];

export function FinanceToolsShell({
  tab,
  onTabChange,
  panels,
}: {
  tab: ToolsTabSelection;
  onTabChange: (t: ToolsTab) => void;
  panels: Record<ToolsTab, ReactNode>;
}) {
  return (
    <section id="finance-tools" data-tour="tour-manage" className="space-y-6">
      <div
        role="tablist"
        aria-label="Tools sections"
        className={`${SEGMENTED_TRACK_CLASS} -mx-1 flex min-w-0 flex-nowrap gap-0 overflow-x-auto overscroll-x-contain pb-0.5`}
      >
        {TAB_DEF.map(({ id, label }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tools-tab-${id}`}
              aria-selected={selected}
              aria-controls={`tools-panel-${id}`}
              data-tour={id === 'audit' ? 'tour-tools-audit' : id === 'sync' ? 'tour-tools-notify' : undefined}
              className={`${segmentedTriggerClass(selected)} shrink-0 snap-start`}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === null ? (
        <div
          className="rounded-xl border-2 border-dashed border-slate-300/80 bg-white px-6 py-14 text-center dark:border-moss-border dark:bg-moss-surface"
          role="status"
        >
          <p className="font-display text-lg font-semibold text-sage-900 dark:text-moss-fg">Pick a tools section</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sage-600 dark:text-moss-muted">
            <strong className="text-sage-800 dark:text-moss-subtle">Sync &amp; alerts</strong> for notifications and server
            reload, or <strong className="text-sage-800 dark:text-moss-subtle">Audit</strong> to see who changed what.
          </p>
        </div>
      ) : (
        TAB_DEF.map(({ id }) => (
          <div
            key={id}
            role="tabpanel"
            id={`tools-panel-${id}`}
            aria-labelledby={`tools-tab-${id}`}
            hidden={tab !== id}
          >
            {panels[id]}
          </div>
        ))
      )}
    </section>
  );
}
