export type AppTab = 'dashboard' | 'workspace' | 'tools';

const TABS: { id: AppTab; label: string; panelId: string }[] = [
  { id: 'dashboard', label: 'Dashboard', panelId: 'app-tabpanel-dashboard' },
  { id: 'workspace', label: 'Workspace', panelId: 'app-tabpanel-workspace' },
  { id: 'tools', label: 'Tools', panelId: 'app-tabpanel-tools' },
];

/**
 * Primary app areas — paired tabpanels render in {@link App} (single visible panel).
 */
export function AppPrimaryTabs({
  value,
  onChange,
}: {
  value: AppTab;
  onChange: (t: AppTab) => void;
}) {
  return (
    <div
      id="finance-primary-tabs"
      data-tour="tour-nav-shortcuts"
      className="hidden border-b border-slate-200/90 bg-sage-50/95 backdrop-blur-md dark:border-moss-border dark:bg-moss-bg/95 lg:sticky lg:top-[5.15rem] lg:z-30 lg:block xl:top-[5.35rem]"
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 xl:max-w-[96rem]">
        <div
          role="tablist"
          aria-label="Main areas"
          className="flex w-full gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm dark:border-moss-border dark:bg-moss-surface sm:max-w-xl sm:gap-1.5"
        >
          {TABS.map(({ id, label, panelId }) => {
            const selected = value === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                id={`app-tab-${id}`}
                className={`min-h-[44px] flex-1 rounded-lg px-2 py-2 text-center text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-moss-bg sm:px-4 sm:text-sm ${
                  selected
                    ? 'bg-teal-700 text-white shadow-sm dark:bg-teal-600'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-moss-subtle dark:hover:bg-moss-elevated'
                }`}
                onClick={() => onChange(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
