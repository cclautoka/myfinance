import type { AppTab } from './AppPrimaryTabs';
import { zLayers } from '../../ui/zLayers';

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 14a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4Zm9 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconLayers({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m12 4 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4M4 16l8 4 8-4"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWrench({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.35 6.35a2 2 0 0 1-2.83-2.83l6.35-6.35a6 6 0 0 1 7.94-7.94l-3.76 3.76-.01.02Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV: { id: AppTab; label: string; icon: typeof IconGrid }[] = [
  { id: 'dashboard', label: 'Home', icon: IconGrid },
  { id: 'workspace', label: 'Work', icon: IconLayers },
  { id: 'tools', label: 'Tools', icon: IconWrench },
];

/**
 * Matches {@link AppPrimaryTabs} — hidden on `lg` where the top tab row is used.
 */
export function MobileBottomNav({
  appTab,
  onAppTabChange,
}: {
  appTab: AppTab;
  onAppTabChange: (t: AppTab) => void;
}) {
  const navBtn = (active: boolean) =>
    `flex min-h-[52px] min-w-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-all active:scale-[0.97] ${
      active
        ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
        : 'text-slate-700 hover:bg-white/80 dark:text-moss-subtle dark:hover:bg-moss-surface'
    }`;

  return (
    <nav
      id="finance-mobile-bottom-nav"
      data-tour="tour-nav-shortcuts"
      aria-label="Main areas"
      className="pointer-events-none fixed inset-x-0 bottom-0 px-[max(0.75rem,env(safe-area-inset-left,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 pr-[max(0.75rem,env(safe-area-inset-right,0px))] lg:hidden"
      style={{ zIndex: zLayers.dockNav }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-lg border-2 border-slate-200/90 bg-slate-100/90 p-0.5 shadow-lg backdrop-blur-md dark:border-moss-border dark:bg-moss-bg dark:shadow-[0_-4px_36px_rgba(0,0,0,0.45)]">
        <div className="flex items-stretch justify-around gap-0.5 rounded-md bg-transparent">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = appTab === id;
            return (
              <button
                key={id}
                type="button"
                className={navBtn(active)}
                aria-current={active ? 'page' : undefined}
                onClick={() => onAppTabChange(id)}
              >
                <Icon className={active ? 'text-white dark:text-slate-950' : undefined} />
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    active ? 'text-white dark:text-slate-950' : 'text-slate-800 dark:text-moss-subtle'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
