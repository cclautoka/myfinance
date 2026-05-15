import { SegmentedChoice } from './SegmentedChoice';

type BoolSegment = 'off' | 'on';

/** Boolean setting as a two-segment control (same chrome as household mode). */
export function SegmentedToggle({
  name,
  checked,
  onCheckedChange,
  'aria-label': ariaLabel,
  size = 'default',
  offLabel = 'Off',
  onLabel = 'On',
  disabled = false,
  className = '',
}: {
  name: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-label': string;
  size?: 'default' | 'compact';
  offLabel?: string;
  onLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const options: { id: BoolSegment; label: string }[] = [
    { id: 'off', label: offLabel },
    { id: 'on', label: onLabel },
  ];

  return (
    <div className={`${disabled ? 'pointer-events-none opacity-45' : ''} ${className}`.trim()}>
      <SegmentedChoice
        name={name}
        aria-label={ariaLabel}
        size={size}
        value={checked ? 'on' : 'off'}
        onChange={(v) => onCheckedChange(v === 'on')}
        options={options}
      />
    </div>
  );
}
