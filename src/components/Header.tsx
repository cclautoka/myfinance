import type { ThemePreference } from '../types/finance';

export function Header({
  theme,
  onTheme,
}: {
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-sage-300/70 bg-white/96 backdrop-blur-md dark:border-moss-border dark:bg-moss-bg/96">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage-600 dark:text-moss-muted">Household finances</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-sage-950 dark:text-moss-fg sm:text-[2.125rem]">
            Dashboard workspace
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-snug text-sage-700 dark:text-moss-subtle">
            Current-month metrics, archived months, worksheets, then planning tools—all local to this browser until you reset or export.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-sage-300 bg-sage-50 p-1 dark:border-moss-border dark:bg-moss-elevated">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTheme(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
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
