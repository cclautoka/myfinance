import type { WorkspaceTab } from './FinanceWorkspaceShell';

const LINKS: { id: string; label: string; workspaceTab?: WorkspaceTab }[] = [
  { id: 'finance-dashboard', label: 'Dashboard' },
  { id: 'finance-surprise-log', label: 'Surprise costs' },
  { id: 'finance-guidance', label: 'Guidance' },
  { id: 'finance-history', label: 'Past months', workspaceTab: 'past' },
  { id: 'finance-household', label: 'Your numbers', workspaceTab: 'household' },
  { id: 'finance-plan', label: 'Plan & bills', workspaceTab: 'plan' },
  { id: 'finance-manage', label: 'Tools & alerts', workspaceTab: 'backup' },
];

function scrollTo(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function FinanceQuickNav({
  dataTour,
  onWorkspaceTab,
}: {
  dataTour?: string;
  /** When set, “Past months” / household / plan / backup jump here and open the matching tab. */
  onWorkspaceTab?: (t: WorkspaceTab) => void;
}) {
  const onClick = (id: string, tab?: WorkspaceTab) => {
    if (tab !== undefined && onWorkspaceTab) {
      onWorkspaceTab(tab);
      requestAnimationFrame(() => {
        scrollTo(document.getElementById('finance-workspace'));
      });
      return;
    }
    scrollTo(document.getElementById(id));
  };

  return (
    <nav
      id="finance-quick-nav"
      data-tour={dataTour}
      aria-label="Page sections"
      className="sticky top-[4.85rem] z-30 hidden border-b border-sage-300/60 bg-gradient-to-r from-emerald-50/50 via-white to-violet-50/45 py-3.5 backdrop-blur-md dark:border-moss-border dark:from-emerald-950/18 dark:via-moss-bg/95 dark:to-violet-950/22 lg:block sm:top-[5.15rem]"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 sm:px-6 xl:max-w-[96rem]">
        <span className="mr-1 self-center text-[11px] font-semibold uppercase tracking-[0.14em] text-sage-700 dark:text-moss-muted">
          Sections
        </span>
        <div className="flex flex-1 flex-wrap gap-2">
          {LINKS.map(({ id, label, workspaceTab }) => (
            <button
              key={id}
              type="button"
              onClick={() => onClick(id, workspaceTab)}
              className="rounded-full border border-sage-400/80 bg-white px-3.5 py-2 text-xs font-semibold text-sage-900 shadow-sm transition-colors hover:border-sage-700 hover:bg-sage-800 hover:text-white dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg dark:hover:border-moss-primary dark:hover:bg-moss-primary dark:hover:text-moss-on-primary"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
