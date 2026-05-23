import { SEGMENTED_TRACK_CLASS, segmentedTriggerClass } from '../ui/segmentedSurface';

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
      <div className="cap-safe-x mx-auto w-full min-w-0 max-w-6xl py-3 xl:max-w-[96rem]">
        <div role="tablist" aria-label="Main areas" className={`${SEGMENTED_TRACK_CLASS} w-full sm:max-w-xl`}>
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
                className={`${segmentedTriggerClass(selected)} text-xs sm:text-sm`}
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
