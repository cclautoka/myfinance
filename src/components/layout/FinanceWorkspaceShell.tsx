import type { ReactNode } from 'react';
import {
  WORKSPACE_SECTION_SHELL,
  WORKSPACE_TAB_TOOLBAR,
  workspaceTabIdle,
  workspaceTabSelected,
} from './sectionAccents';

export type WorkspaceTab = 'past' | 'household' | 'plan';

export type WorkspaceTabSelection = WorkspaceTab | null;

const TAB_DEF: { id: WorkspaceTab; label: string }[] = [
  { id: 'past', label: 'Past months' },
  { id: 'household', label: 'Your numbers' },
  { id: 'plan', label: 'Plan & bills' },
];

const INTRO_BY_TAB: Record<WorkspaceTab, { eyebrow: string; title: string; body: string; details?: string }> = {
  past: {
    eyebrow: 'History & export',
    title: 'Past months',
    body: 'Pick a month, recap, export CSV.',
    details: 'The live month stays on the Dashboard tab.',
  },
  household: {
    eyebrow: 'Household data',
    title: 'Your numbers',
    body: 'Income, essentials, loans — edits hit the dashboard the same minute.',
    details: 'Open when you need to tune the workbook.',
  },
  plan: {
    eyebrow: 'Allocation & savings',
    title: 'Plan & bills',
    body: 'Split, envelopes, emergency, debt balances.',
    details: 'Bill calendar stays on the Dashboard tab.',
  },
};

/**
 * Archive + household + plan. Tools & relay live under the app Tools tab.
 */
export function FinanceWorkspaceShell({
  tab,
  onTabChange,
  panels,
}: {
  tab: WorkspaceTabSelection;
  onTabChange: (t: WorkspaceTab) => void;
  panels: Record<WorkspaceTab, ReactNode>;
}) {
  const intro = tab !== null ? INTRO_BY_TAB[tab] : null;

  return (
    <section
      id="finance-workspace"
      data-tour="tour-workspace"
      className={`scroll-mt-40 overflow-hidden sm:scroll-mt-36 ${WORKSPACE_SECTION_SHELL}`}
    >
      <div className={WORKSPACE_TAB_TOOLBAR}>
        <div
          role="tablist"
          aria-label="Workspace sections"
          className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory lg:flex-wrap lg:overflow-visible lg:pb-0 lg:snap-none [&::-webkit-scrollbar]:hidden"
        >
          {TAB_DEF.map(({ id, label }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`workspace-tab-${id}`}
                aria-selected={selected}
                aria-controls={`workspace-panel-${id}`}
                className={`shrink-0 snap-start rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-moss-bg ${
                  selected ? workspaceTabSelected : workspaceTabIdle
                }`}
                onClick={() => onTabChange(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {intro && (
        <div
          className="border-b border-slate-200/80 bg-slate-50/90 px-5 py-7 dark:border-moss-border dark:bg-moss-surface/90 sm:px-8"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300/90">
            {intro.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-sage-900 dark:text-moss-fg sm:text-[1.85rem]">
            {intro.title}
          </h2>
          <p className="mt-3 max-w-3xl text-base font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">
            {intro.body}
          </p>
          {intro.details ? (
            <details className="mt-3 max-w-3xl text-sage-700 dark:text-moss-subtle">
              <summary className="cursor-pointer text-sm font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-200/90">
                Read more
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-sage-600 dark:text-moss-muted">{intro.details}</p>
            </details>
          ) : null}
        </div>
      )}

      <div className="px-5 py-8 sm:px-8 sm:py-10">
        {tab === null ? (
          <div
            className="rounded-xl border-2 border-dashed border-slate-300/80 bg-white px-6 py-14 text-center dark:border-moss-border dark:bg-moss-surface"
            role="status"
          >
            <p className="font-display text-lg font-semibold text-sage-900 dark:text-moss-fg">Pick a workspace section</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sage-600 dark:text-moss-muted">
              Choose <strong className="text-sage-800 dark:text-moss-subtle">Past months</strong>,{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">Your numbers</strong>, or{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">Plan &amp; bills</strong> above. Relay and reset live
              under <strong className="text-sage-800 dark:text-moss-subtle">Tools</strong>.
            </p>
          </div>
        ) : (
          TAB_DEF.map(({ id }) => (
            <div
              key={id}
              role="tabpanel"
              id={`workspace-panel-${id}`}
              aria-labelledby={`workspace-tab-${id}`}
              hidden={tab !== id}
            >
              {panels[id]}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
