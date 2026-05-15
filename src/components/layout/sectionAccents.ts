/**
 * Shared accent palettes — geometric frames, short header gradients.
 */
export type SectionAccent = 'teal' | 'emerald' | 'amber' | 'violet' | 'rose';

const SECTION_RADIUS = 'rounded-xl sm:rounded-2xl';

export const SECTION_PALETTE: Record<
  SectionAccent,
  {
    bandShell: string;
    spotlightShell: string;
    headerGradient: string;
    eyebrowOnHeader: string;
    titleOnHeader: string;
    subtitleOnHeader: string;
  }
> = {
  teal: {
    bandShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-slate-200/90 bg-white px-5 py-9 shadow-md shadow-slate-900/10 dark:border-moss-border dark:bg-moss-elevated dark:shadow-black/40`,
    spotlightShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-teal-600/35 bg-white px-5 py-9 shadow-lg shadow-teal-900/15 dark:border-teal-500/40 dark:bg-moss-elevated dark:shadow-black/50`,
    headerGradient: 'bg-gradient-to-br from-teal-700 to-teal-950 dark:from-teal-800 dark:to-slate-950',
    eyebrowOnHeader: 'text-teal-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-teal-50/95',
  },
  emerald: {
    bandShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-slate-200/90 bg-white px-5 py-9 shadow-md shadow-slate-900/10 dark:border-moss-border dark:bg-moss-elevated dark:shadow-black/40`,
    spotlightShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-emerald-600/35 bg-white px-5 py-9 shadow-lg shadow-emerald-900/15 dark:border-emerald-500/40 dark:bg-moss-elevated dark:shadow-black/50`,
    headerGradient: 'bg-gradient-to-br from-emerald-700 to-teal-950 dark:from-emerald-800 dark:to-slate-950',
    eyebrowOnHeader: 'text-emerald-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-emerald-50/95',
  },
  amber: {
    bandShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-amber-400/35 bg-white px-5 py-9 shadow-md shadow-amber-900/10 dark:border-amber-600/30 dark:bg-moss-elevated dark:shadow-black/40`,
    spotlightShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-amber-500/45 bg-white px-5 py-9 shadow-lg shadow-amber-900/15 dark:border-amber-500/40 dark:bg-moss-elevated dark:shadow-black/50`,
    headerGradient: 'bg-gradient-to-br from-amber-700 to-orange-900 dark:from-amber-800 dark:to-amber-950',
    eyebrowOnHeader: 'text-amber-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-amber-50/95',
  },
  violet: {
    bandShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-violet-400/30 bg-white px-5 py-9 shadow-md shadow-violet-900/10 dark:border-violet-500/30 dark:bg-moss-elevated dark:shadow-black/40`,
    spotlightShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-violet-500/40 bg-white px-5 py-9 shadow-lg shadow-violet-900/15 dark:border-violet-400/35 dark:bg-moss-elevated dark:shadow-black/50`,
    headerGradient: 'bg-gradient-to-br from-violet-700 to-slate-900 dark:from-violet-800 dark:to-slate-950',
    eyebrowOnHeader: 'text-violet-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-violet-50/95',
  },
  rose: {
    bandShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-rose-400/35 bg-white px-5 py-9 shadow-md shadow-rose-900/10 dark:border-rose-500/30 dark:bg-moss-elevated dark:shadow-black/40`,
    spotlightShell: `overflow-hidden ${SECTION_RADIUS} border-2 border-rose-500/40 bg-white px-5 py-9 shadow-lg shadow-rose-900/15 dark:border-rose-500/35 dark:bg-moss-elevated dark:shadow-black/50`,
    headerGradient: 'bg-gradient-to-br from-rose-700 to-orange-950 dark:from-rose-800 dark:to-orange-950',
    eyebrowOnHeader: 'text-rose-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-rose-50/95',
  },
};

/** Top accent stripe + flat wash for nested cards */
export const cardAccentTone: Record<SectionAccent, string> = {
  teal: 'border-t-[3px] border-t-teal-600 bg-white dark:border-t-teal-500 dark:bg-moss-surface',
  emerald: 'border-t-[3px] border-t-emerald-600 bg-white dark:border-t-emerald-500 dark:bg-moss-surface',
  amber: 'border-t-[3px] border-t-amber-500 bg-white dark:border-t-amber-400 dark:bg-moss-surface',
  violet: 'border-t-[3px] border-t-violet-600 bg-white dark:border-t-violet-500 dark:bg-moss-surface',
  rose: 'border-t-[3px] border-t-rose-500 bg-white dark:border-t-rose-500 dark:bg-moss-surface',
};

export const WORKSPACE_SECTION_SHELL = `${SECTION_RADIUS} border-2 border-slate-200/90 bg-white shadow-lg shadow-slate-900/10 dark:border-moss-border dark:bg-moss-elevated dark:shadow-black/45`;

export const WORKSPACE_TAB_TOOLBAR =
  'border-b-2 border-slate-200/90 bg-slate-100/90 px-4 py-3.5 dark:border-moss-border dark:bg-moss-surface sm:px-6 sm:py-4';

export const workspaceTabIdle =
  'rounded-lg border border-slate-300/90 bg-white text-slate-900 shadow-sm transition-all hover:border-teal-500/50 hover:bg-teal-50/70 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg dark:hover:border-teal-500/40 dark:hover:bg-teal-950/25';

export const workspaceTabSelected =
  'rounded-lg border border-teal-600 bg-teal-600 text-white shadow-md dark:border-teal-500 dark:bg-teal-500 dark:text-white';
