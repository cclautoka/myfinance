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
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { id: T; label: string }[];
  'aria-label': string;
  size?: 'default' | 'compact';
}) {
  const compact = size === 'compact';
  return (
    <div className={SEGMENTED_TRACK_CLASS} role="toolbar" aria-label={ariaLabel}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={segmentedTriggerClass(selected, compact ? { compact: true } : undefined)}
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
