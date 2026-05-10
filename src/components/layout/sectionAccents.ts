/**
 * Shared accent palettes for section heroes and cards — matches guidance strip quality
 * but rotates hue by area (dashboard, surprises, worksheets, etc.).
 */
export type SectionAccent = 'teal' | 'emerald' | 'amber' | 'violet' | 'rose';

export const SECTION_PALETTE: Record<
  SectionAccent,
  {
    /** Softer framed section (e.g. dashboard band). */
    bandShell: string;
    /** Stronger framed section (e.g. guidance). */
    spotlightShell: string;
    headerGradient: string;
    eyebrowOnHeader: string;
    titleOnHeader: string;
    subtitleOnHeader: string;
  }
> = {
  teal: {
    bandShell:
      'overflow-hidden rounded-[2rem] border-2 border-teal-600/65 bg-gradient-to-b from-white via-teal-50/35 to-sage-50/90 px-5 py-10 shadow-lg shadow-teal-900/10 ring-1 ring-teal-500/20 dark:border-teal-500/45 dark:from-moss-elevated dark:via-teal-950/28 dark:to-moss-bg dark:shadow-black/30 dark:ring-teal-400/18',
    spotlightShell:
      'overflow-hidden rounded-[2rem] border-2 border-teal-600/80 bg-gradient-to-b from-white via-teal-50/40 to-sage-50/90 px-5 py-10 shadow-2xl shadow-teal-900/15 ring-2 ring-teal-500/25 dark:border-teal-500/50 dark:from-moss-elevated dark:via-teal-950/30 dark:to-moss-bg dark:shadow-black/40 dark:ring-teal-400/20',
    headerGradient:
      'bg-gradient-to-r from-teal-800 via-teal-900 to-sage-900 dark:from-teal-900 dark:via-teal-950 dark:to-sage-950',
    eyebrowOnHeader: 'text-teal-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-teal-50/95',
  },
  emerald: {
    bandShell:
      'overflow-hidden rounded-[2rem] border-2 border-emerald-600/65 bg-gradient-to-b from-white via-emerald-50/35 to-sage-50/90 px-5 py-10 shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-500/20 dark:border-emerald-500/45 dark:from-moss-elevated dark:via-emerald-950/25 dark:to-moss-bg dark:shadow-black/30 dark:ring-emerald-400/18',
    spotlightShell:
      'overflow-hidden rounded-[2rem] border-2 border-emerald-600/80 bg-gradient-to-b from-white via-emerald-50/40 to-sage-50/85 px-5 py-10 shadow-2xl shadow-emerald-900/12 ring-2 ring-emerald-500/25 dark:border-emerald-500/48 dark:from-moss-elevated dark:via-emerald-950/28 dark:to-moss-bg dark:shadow-black/40 dark:ring-emerald-400/20',
    headerGradient:
      'bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 dark:from-emerald-900 dark:via-emerald-950 dark:to-teal-950',
    eyebrowOnHeader: 'text-emerald-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-emerald-50/95',
  },
  amber: {
    bandShell:
      'overflow-hidden rounded-[2rem] border-2 border-amber-500/70 bg-gradient-to-b from-white via-amber-50/40 to-orange-50/50 px-5 py-10 shadow-lg shadow-amber-900/10 ring-1 ring-amber-400/25 dark:border-amber-500/40 dark:from-moss-elevated dark:via-amber-950/22 dark:to-moss-bg dark:shadow-black/30 dark:ring-amber-400/15',
    spotlightShell:
      'overflow-hidden rounded-[2rem] border-2 border-amber-500/85 bg-gradient-to-b from-white via-amber-50/45 to-orange-50/55 px-5 py-10 shadow-2xl shadow-amber-900/12 ring-2 ring-amber-400/30 dark:border-amber-500/50 dark:from-moss-elevated dark:via-amber-950/26 dark:to-moss-bg dark:shadow-black/40 dark:ring-amber-400/22',
    headerGradient:
      'bg-gradient-to-r from-amber-700 via-orange-800 to-amber-900 dark:from-amber-800 dark:via-orange-900 dark:to-amber-950',
    eyebrowOnHeader: 'text-amber-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-amber-50/95',
  },
  violet: {
    bandShell:
      'overflow-hidden rounded-[2rem] border-2 border-violet-600/65 bg-gradient-to-b from-white via-violet-50/35 to-indigo-50/45 px-5 py-10 shadow-lg shadow-violet-900/10 ring-1 ring-violet-400/22 dark:border-violet-500/42 dark:from-moss-elevated dark:via-violet-950/24 dark:to-moss-bg dark:shadow-black/30 dark:ring-violet-400/16',
    spotlightShell:
      'overflow-hidden rounded-[2rem] border-2 border-violet-600/80 bg-gradient-to-b from-white via-violet-50/38 to-indigo-50/48 px-5 py-10 shadow-2xl shadow-violet-900/12 ring-2 ring-violet-400/28 dark:border-violet-500/50 dark:from-moss-elevated dark:via-violet-950/28 dark:to-moss-bg dark:shadow-black/40 dark:ring-violet-400/18',
    headerGradient:
      'bg-gradient-to-r from-violet-800 via-indigo-900 to-violet-950 dark:from-violet-900 dark:via-indigo-950 dark:to-violet-950',
    eyebrowOnHeader: 'text-violet-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-violet-50/95',
  },
  rose: {
    bandShell:
      'overflow-hidden rounded-[2rem] border-2 border-rose-500/68 bg-gradient-to-b from-white via-rose-50/32 to-orange-50/40 px-5 py-10 shadow-lg shadow-rose-900/10 ring-1 ring-rose-400/22 dark:border-rose-500/42 dark:from-moss-elevated dark:via-rose-950/20 dark:to-moss-bg dark:shadow-black/30 dark:ring-rose-400/16',
    spotlightShell:
      'overflow-hidden rounded-[2rem] border-2 border-rose-500/82 bg-gradient-to-b from-white via-rose-50/36 to-orange-50/45 px-5 py-10 shadow-2xl shadow-rose-900/12 ring-2 ring-rose-400/26 dark:border-rose-500/48 dark:from-moss-elevated dark:via-rose-950/24 dark:to-moss-bg dark:shadow-black/40 dark:ring-rose-400/18',
    headerGradient:
      'bg-gradient-to-r from-rose-800 via-rose-900 to-orange-950 dark:from-rose-900 dark:via-rose-950 dark:to-orange-950',
    eyebrowOnHeader: 'text-rose-100/95',
    titleOnHeader: 'text-white',
    subtitleOnHeader: 'text-rose-50/95',
  },
};

/** Thin top stripe + soft wash for cards nested under accented sections */
export const cardAccentTone: Record<SectionAccent, string> = {
  teal:
    'border-t-[3px] border-t-teal-600 bg-gradient-to-b from-teal-50/50 to-transparent dark:border-t-teal-500 dark:from-teal-950/35',
  emerald:
    'border-t-[3px] border-t-emerald-600 bg-gradient-to-b from-emerald-50/55 to-transparent dark:border-t-emerald-500 dark:from-emerald-950/32',
  amber:
    'border-t-[3px] border-t-amber-500 bg-gradient-to-b from-amber-50/50 to-transparent dark:border-t-amber-400 dark:from-amber-950/28',
  violet:
    'border-t-[3px] border-t-violet-600 bg-gradient-to-b from-violet-50/45 to-transparent dark:border-t-violet-500 dark:from-violet-950/30',
  rose:
    'border-t-[3px] border-t-rose-500 bg-gradient-to-b from-rose-50/45 to-transparent dark:border-t-rose-500 dark:from-rose-950/26',
};

/** Worksheets / archive hub outer frame — internal padding stays controlled by FinanceWorkspaceShell. */
export const WORKSPACE_SECTION_SHELL =
  'rounded-[2rem] border-2 border-violet-600/65 bg-white shadow-lg shadow-violet-900/8 ring-1 ring-violet-400/22 dark:border-violet-500/42 dark:bg-moss-elevated dark:shadow-black/28 dark:ring-violet-400/14';

export const WORKSPACE_TAB_TOOLBAR =
  'border-b border-violet-200/90 bg-gradient-to-b from-violet-50/95 via-white to-indigo-50/50 px-4 py-4 dark:border-violet-800/35 dark:from-violet-950/30 dark:via-moss-surface dark:to-moss-bg sm:px-6 sm:py-5';

export const workspaceTabIdle =
  'border-violet-200/90 bg-white text-violet-950 shadow-sm hover:border-violet-400/70 hover:bg-violet-50/90 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg dark:hover:border-violet-500/50 dark:hover:bg-violet-950/25';

export const workspaceTabSelected =
  'border-violet-800 bg-violet-900 text-white shadow-md dark:border-violet-400 dark:bg-violet-700 dark:text-white';
