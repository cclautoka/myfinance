/**
 * Shared chrome for {@link SegmentedChoice}, {@link SegmentedButtonGroup}, and workspace-style tab strips.
 */
export const SEGMENTED_TRACK_CLASS =
  'flex items-stretch rounded-lg border-2 border-slate-200/90 bg-slate-100/90 p-0.5 shadow-inner shadow-slate-900/5 dark:border-moss-border dark:bg-moss-bg dark:shadow-none';

export function segmentedTriggerClass(selected: boolean, opts?: { compact?: boolean }): string {
  const h = opts?.compact ? 'min-h-[36px]' : 'min-h-[44px]';
  const text = opts?.compact ? 'text-[10px] font-semibold sm:text-xs' : 'text-sm font-semibold';
  const pad = opts?.compact ? 'px-1.5 py-1.5 sm:px-2.5' : 'px-2 py-2 sm:px-4';
  const base = `relative flex ${h} min-w-0 flex-1 cursor-pointer select-none items-center justify-center rounded-md ${pad} text-center ${text} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-moss-bg`;
  const state = selected
    ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
    : 'text-slate-700 hover:bg-white/80 dark:text-moss-subtle dark:hover:bg-moss-surface';
  return `${base} ${state}`;
}
