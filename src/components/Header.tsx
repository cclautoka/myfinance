import { useState } from 'react';
import type { ThemePreference } from '../types/finance';

export function Header({
  theme,
  onTheme,
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
}) {
  const [buildOpen, setBuildOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-sage-300/70 bg-white/96 backdrop-blur-md dark:border-moss-border dark:bg-moss-bg/96">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sage-600 dark:text-moss-muted sm:text-[11px] sm:tracking-[0.18em]">
            Household finances
          </p>
          <h1 className="font-display text-xl font-semibold tracking-tight text-sage-950 dark:text-moss-fg sm:text-[2.125rem]">
            <span className="sm:hidden">Our Finance</span>
            <span className="hidden sm:inline">Dashboard workspace</span>
          </h1>
          <p className="mt-0.5 hidden max-w-xl text-sm leading-snug text-sage-700 dark:text-moss-subtle sm:block">
            Current-month metrics, archived months, worksheets, then planning tools—all local to this browser until you reset or
            export.
          </p>
          <div className="mt-1 md:hidden">
            <button
              type="button"
              onClick={() => setBuildOpen((o) => !o)}
              className="text-[10px] font-semibold uppercase tracking-wide text-sage-500 underline decoration-sage-400/80 underline-offset-2 dark:text-moss-muted dark:decoration-moss-border"
            >
              Build info
            </button>
            {buildOpen ? (
              <p className="mt-1 font-mono text-[10px] leading-snug text-sage-600 dark:text-moss-muted">
                {__BUILD_SHA__} · {new Date(__BUILD_TIME_ISO__).toLocaleString()}
              </p>
            ) : null}
          </div>
          <p className="mt-1 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-500 dark:text-moss-muted md:block">
            Build {__BUILD_SHA__} · {new Date(__BUILD_TIME_ISO__).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-sage-300 bg-sage-50 p-0.5 dark:border-moss-border dark:bg-moss-elevated sm:gap-2 sm:p-1">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTheme(t)}
              className={`rounded-full px-2 py-1.5 text-[10px] font-medium capitalize transition-colors sm:px-3 sm:text-xs ${
                theme === t ? 'btn-toggle-active' : 'btn-toggle-idle'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="h-[3px] w-full bg-gradient-to-r from-emerald-600 via-amber-500 to-violet-600 opacity-[0.92] dark:from-emerald-500 dark:via-amber-400 dark:to-violet-500 dark:opacity-80"
      />
    </header>
  );
}
