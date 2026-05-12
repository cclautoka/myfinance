import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceTab } from './FinanceWorkspaceShell';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSurprise({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2m-.4 6.4 1.4-1.4M12 21v-2m6.4.4-1.4-1.4M21 12h-2m.4-6.4-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 8a4 4 0 0 1 4 4c0 2-2 3-4 5-2-2-4-3-4-5a4 4 0 0 1 4-4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGuidance({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18h6M10 22h4M8.5 14.5a3.5 3.5 0 1 1 7 0c0 1.5-1 2.5-2 3h-3c-1-.5-2-1.5-2-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 2v1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconMore({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="19" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}

const MORE_LINKS: { label: string; tab: WorkspaceTab }[] = [
  { label: 'Past months', tab: 'past' },
  { label: 'Your numbers', tab: 'household' },
  { label: 'Plan & bills', tab: 'plan' },
  { label: 'Tools & alerts', tab: 'backup' },
];

/**
 * Thumb-first navigation on small viewports; hidden from `lg` where FinanceQuickNav is used.
 */
export function MobileBottomNav({
  onWorkspaceTab,
}: {
  onWorkspaceTab: (t: WorkspaceTab) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, closeSheet]);

  const openWorkspace = (tab: WorkspaceTab) => {
    onWorkspaceTab(tab);
    closeSheet();
    requestAnimationFrame(() => {
      scrollToId('finance-workspace');
    });
  };

  return (
    <>
      <nav
        id="finance-mobile-bottom-nav"
        data-tour="tour-bottom-nav"
        aria-label="Main sections"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-sage-300/70 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_30px_rgba(43,48,39,0.08)] backdrop-blur-lg dark:border-moss-border dark:bg-moss-bg/95 dark:shadow-[0_-8px_32px_rgba(0,0,0,0.45)] lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0 px-1">
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-sage-700 transition-colors hover:bg-sage-100/90 active:bg-sage-200/80 dark:text-moss-muted dark:hover:bg-moss-surface dark:active:bg-moss-elevated"
            onClick={() => scrollToId('finance-dashboard')}
          >
            <IconDashboard className="text-emerald-700 dark:text-emerald-400/90" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-sage-800 dark:text-moss-subtle">
              Home
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-sage-700 transition-colors hover:bg-sage-100/90 active:bg-sage-200/80 dark:text-moss-muted dark:hover:bg-moss-surface dark:active:bg-moss-elevated"
            onClick={() => scrollToId('finance-surprise-log')}
          >
            <IconSurprise className="text-amber-700 dark:text-amber-400/90" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-sage-800 dark:text-moss-subtle">
              Shocks
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-sage-700 transition-colors hover:bg-sage-100/90 active:bg-sage-200/80 dark:text-moss-muted dark:hover:bg-moss-surface dark:active:bg-moss-elevated"
            onClick={() => scrollToId('finance-guidance')}
          >
            <IconGuidance className="text-teal-700 dark:text-teal-400/90" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-sage-800 dark:text-moss-subtle">
              Tips
            </span>
          </button>
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-sage-700 transition-colors hover:bg-sage-100/90 active:bg-sage-200/80 dark:text-moss-muted dark:hover:bg-moss-surface dark:active:bg-moss-elevated"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
          >
            <IconMore className="text-violet-700 dark:text-violet-400/90" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-sage-800 dark:text-moss-subtle">
              More
            </span>
          </button>
        </div>
      </nav>

      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-sage-950/40 backdrop-blur-[2px] dark:bg-black/55"
            onClick={closeSheet}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-sheet-title"
            className="absolute inset-x-0 bottom-0 max-h-[min(72vh,28rem)] rounded-t-3xl border border-sage-200/90 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl dark:border-moss-border dark:bg-moss-elevated"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-sage-300 dark:bg-moss-border" aria-hidden />
            <h2
              id="mobile-more-sheet-title"
              className="font-display text-lg font-bold text-sage-900 dark:text-moss-fg"
            >
              Worksheets & tools
            </h2>
            <p className="mt-1 text-sm text-sage-600 dark:text-moss-muted">Open a tab — same data as on larger screens.</p>
            <ul className="mt-5 space-y-2">
              {MORE_LINKS.map(({ label, tab }) => (
                <li key={tab}>
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-sage-200/90 bg-sage-50/80 px-4 py-3.5 text-left text-sm font-semibold text-sage-900 transition-colors hover:border-violet-400/60 hover:bg-violet-50/50 active:scale-[0.99] dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg dark:hover:border-violet-500/40 dark:hover:bg-violet-950/25"
                    onClick={() => openWorkspace(tab)}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost mx-auto mt-4 block w-full py-2 text-sm font-semibold" onClick={closeSheet}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
