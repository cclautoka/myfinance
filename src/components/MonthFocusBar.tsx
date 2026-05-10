import { formatCalendarMonthHeading, historySelectableMonthKeys } from '../data/defaults';
import { ListboxSelect } from './ui/ListboxSelect';

export function MonthFocusBar({
  monthKey,
  onMonthKeyChange,
}: {
  monthKey: string;
  onMonthKeyChange: (mk: string) => void;
}) {
  const keys = historySelectableMonthKeys();
  const options = keys.map((mk) => ({
    value: mk,
    label: formatCalendarMonthHeading(mk),
  }));
  return (
    <section
      id="month-focus"
      className="rounded-2xl border-[3px] border-sage-900/15 bg-white px-4 py-4 shadow-md dark:border-moss-border dark:bg-moss-elevated sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sage-700 dark:text-moss-muted">
            Pick an old month
          </p>
          <p className="mt-1 max-w-xl text-sm font-semibold leading-snug text-sage-800 dark:text-moss-subtle">
            Past months only — the recap tiles, downloadable report, <strong className="text-sage-950 dark:text-moss-fg">and the pay slip table farther down</strong> all mirror this picker.{' '}
            The <strong className="text-sage-950 dark:text-moss-fg">Dashboard · Paycheque log</strong> chunk is separate and always stays on <strong className="text-sage-950 dark:text-moss-fg">today&apos;s calendar month</strong>.
          </p>
        </div>
        {keys.length > 0 ? (
          <ListboxSelect label="Month" value={monthKey} options={options} onChange={onMonthKeyChange} />
        ) : (
          <p className="max-w-xs text-sm text-sage-600 dark:text-moss-muted">
            No prior months in range yet — check back once the calendar moves past April 2026.
          </p>
        )}
      </div>
    </section>
  );
}
