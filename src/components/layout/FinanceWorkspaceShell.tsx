import type { ReactNode } from 'react';
import {
  WORKSPACE_SECTION_SHELL,
  WORKSPACE_TAB_TOOLBAR,
  workspaceTabIdle,
  workspaceTabSelected,
} from './sectionAccents';

export type WorkspaceTab = 'past' | 'household' | 'plan' | 'backup';

export type WorkspaceTabSelection = WorkspaceTab | null;

const TAB_DEF: { id: WorkspaceTab; label: string }[] = [
  { id: 'past', label: 'Past months' },
  { id: 'household', label: 'Your numbers' },
  { id: 'plan', label: 'Plan & bills' },
  { id: 'backup', label: 'Tools & alerts' },
];

const INTRO_BY_TAB: Record<WorkspaceTab, { eyebrow: string; title: string; body: string }> = {
  past: {
    eyebrow: 'History & export',
    title: 'Past months',
    body: 'Choose a month below, recap what changed, and grab a CSV. The current month still lives on the Dashboard above.',
  },
  household: {
    eyebrow: 'Household data',
    title: 'Your numbers',
    body: 'Edit income, essentials, and loans — these values flow into the dashboard, allocation, and guidance.',
  },
  plan: {
    eyebrow: 'Allocation & savings',
    title: 'Plan & bills',
    body: 'Tweak the split, fun money, emergency fund, and debt balances. The bill calendar & checkmarks stay on the Dashboard.',
  },
  backup: {
    eyebrow: 'Housekeeping',
    title: 'Tools & alerts',
    body: 'Email notifications, replay the tour, CSV export under Past months, or reset this browser. Auto deposit logs live in Household → Your numbers.',
  },
};

/**
 * Tabs for archive + Household + Plan + housekeeping. No tab selected until the user chooses one.
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
      {/* Tabs first — full-width toolbar */}
      <div className={WORKSPACE_TAB_TOOLBAR}>
        <div
          role="tablist"
          aria-label="Archive and planners"
          className="flex flex-wrap items-center gap-2"
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
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-moss-bg ${
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

      {/* Context header only after a tab is chosen — idle state is tabs + empty panel copy */}
      {intro && (
        <div
          className="border-b border-violet-200/65 bg-gradient-to-b from-violet-50/50 to-white px-5 py-8 dark:border-violet-800/30 dark:from-violet-950/20 dark:to-moss-elevated sm:px-8"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300/90">
            {intro.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-sage-900 dark:text-moss-fg sm:text-[2rem]">
            {intro.title}
          </h2>
          <p className="mt-3 max-w-3xl text-base font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">
            {intro.body}
          </p>
        </div>
      )}

      <div className="px-5 py-8 sm:px-8 sm:py-10">
        {tab === null ? (
          <div
            className="rounded-2xl border-2 border-dashed border-violet-300/80 bg-violet-50/40 px-6 py-16 text-center dark:border-violet-700/35 dark:bg-violet-950/15"
            role="status"
          >
            <p className="font-display text-lg font-semibold text-sage-900 dark:text-moss-fg">Nothing open yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sage-600 dark:text-moss-muted">
              Choose <strong className="text-sage-800 dark:text-moss-subtle">Past months</strong>,{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">Your numbers</strong>,{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">Plan &amp; bills</strong>, or{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">Tips &amp; backup</strong> in the row above.
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
