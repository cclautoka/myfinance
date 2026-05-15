import { useState } from 'react';
import type { ThemePreference } from '../types/finance';
import { clearHouseholdSession } from '../utils/householdSession';
import { zLayers } from '../ui/zLayers';
import { SegmentedButtonGroup } from './ui/SegmentedButtonGroup';
import { THEME_SEGMENT_OPTIONS } from './ui/themeSegmentedOptions';

export function Header({
  theme,
  onTheme,
  householdSignedIn = false,
  onOpenAccount,
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
  /** When true, shows Sign out in the header. */
  householdSignedIn?: boolean;
  /** When set and not signed in, shows Sign in (e.g. public shell). */
  onOpenAccount?: () => void;
}) {
  const [buildOpen, setBuildOpen] = useState(false);

  return (
    <header
      className="sticky top-0 border-b-2 border-slate-200/95 bg-white/95 shadow-sm backdrop-blur-md dark:border-moss-border dark:bg-moss-bg/95 dark:shadow-black/30"
      style={{ zIndex: zLayers.stickyHeader }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4 xl:max-w-[96rem]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-400 sm:text-[11px]">
            Household finances
          </p>
          <h1 className="mt-1 font-display text-[1.35rem] font-bold leading-tight tracking-tight text-slate-950 dark:text-moss-fg sm:text-[2.1rem]">
            <span className="sm:hidden">Our Finance</span>
            <span className="hidden sm:inline">Household workspace</span>
          </h1>
          <p className="mt-1 hidden max-w-2xl text-sm font-medium leading-relaxed text-slate-600 dark:text-moss-subtle sm:block">
            Dashboard for this month — Workspace to edit history and plan — Tools for relay, sign-in, and reset.
          </p>
          <div className="mt-1 md:hidden">
            <button
              type="button"
              onClick={() => setBuildOpen((o) => !o)}
              className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 underline decoration-slate-400/80 underline-offset-2 dark:text-moss-muted dark:decoration-moss-border"
            >
              Build info
            </button>
            {buildOpen ? (
              <p className="mt-1 font-mono text-[10px] leading-snug text-slate-600 dark:text-moss-muted">
                {__BUILD_SHA__} · {new Date(__BUILD_TIME_ISO__).toLocaleString()}
              </p>
            ) : null}
          </div>
          <p className="mt-1 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-moss-muted md:block">
            Build {__BUILD_SHA__} · {new Date(__BUILD_TIME_ISO__).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {householdSignedIn ? (
            <button
              type="button"
              className="rounded-xl border border-slate-300/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg dark:hover:bg-moss-elevated"
              onClick={() => {
                clearHouseholdSession();
                window.location.reload();
              }}
            >
              Sign out
            </button>
          ) : onOpenAccount ? (
            <button
              type="button"
              className="rounded-xl border border-teal-500/40 bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
              onClick={() => onOpenAccount()}
            >
              Sign in
            </button>
          ) : null}
          <div className="w-full max-w-[11.5rem] shrink-0 sm:max-w-[13rem]">
            <SegmentedButtonGroup
              aria-label="Color theme"
              value={theme}
              onChange={onTheme}
              options={THEME_SEGMENT_OPTIONS}
              size="compact"
            />
          </div>
        </div>
      </div>
      <div aria-hidden className="h-0.5 w-full bg-teal-600 dark:bg-teal-500" />
    </header>
  );
}
