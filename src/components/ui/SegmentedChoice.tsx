/**
 * Two-option (or few-option) segmented control backed by native radios for forms and a11y.
 */
export function SegmentedChoice<T extends string>({
  name,
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { id: T; label: string }[];
  'aria-label': string;
}) {
  return (
    <div
      className="flex rounded-lg border-2 border-slate-200/90 bg-slate-100/90 p-0.5 shadow-inner shadow-slate-900/5 dark:border-moss-border dark:bg-moss-bg dark:shadow-none"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <label
            key={o.id}
            className={`relative flex min-h-[44px] min-w-0 flex-1 cursor-pointer select-none items-center justify-center rounded-md px-2 py-2 text-center text-sm font-semibold transition-colors sm:px-4 ${
              selected
                ? 'bg-teal-600 text-white shadow-sm dark:bg-teal-500 dark:text-slate-950'
                : 'text-slate-700 hover:bg-white/80 dark:text-moss-subtle dark:hover:bg-moss-surface'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={selected}
              className="sr-only"
              onChange={() => onChange(o.id)}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
