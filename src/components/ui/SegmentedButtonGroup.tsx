import { SEGMENTED_TRACK_CLASS, segmentedTriggerClass } from './segmentedSurface';

/**
 * Same look as {@link SegmentedChoice} but uses buttons (views, theme, no form submit).
 */
export function SegmentedButtonGroup<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  size = 'default',
  animatedIndicator = false,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { id: T; label: string }[];
  'aria-label': string;
  size?: 'default' | 'compact' | 'frame';
  animatedIndicator?: boolean;
}) {
  const compact = size === 'compact';
  const frame = size === 'frame';
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const triggerOpts = frame ? { frame: true } : compact ? { compact: true } : undefined;

  return (
    <div className={`relative ${SEGMENTED_TRACK_CLASS}`} role="toolbar" aria-label={ariaLabel}>
      {animatedIndicator ? (
        <span
          className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md bg-teal-600 shadow-sm transition-transform duration-300 ease-out will-change-transform dark:bg-teal-500"
          style={{
            width: `calc((100% - 4px) / ${options.length})`,
            transform: `translateX(calc(${selectedIndex} * 100%))`,
          }}
          aria-hidden
        />
      ) : null}
      {options.map((o) => {
        const selected = value === o.id;
        const indicatorSelected = animatedIndicator && selected;
        return (
          <button
            key={o.id}
            type="button"
            className={`relative z-10 ${segmentedTriggerClass(selected && !animatedIndicator, triggerOpts)} ${
              indicatorSelected
                ? 'bg-transparent text-white shadow-none dark:text-slate-950'
                : animatedIndicator
                  ? 'bg-transparent text-slate-700 hover:bg-white/50 dark:text-moss-subtle dark:hover:bg-moss-surface/80'
                  : ''
            }`}
            aria-pressed={selected}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
