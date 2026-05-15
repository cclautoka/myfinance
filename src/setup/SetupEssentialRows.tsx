import type { EssentialExpense } from '../types/finance';
import {
  ESSENTIAL_CADENCE_OPTIONS,
  WEEKLY_ESSENTIAL_DAY_OPTIONS,
} from '../data/selectOptions';
import { ListboxSelect } from '../components/ui/ListboxSelect';
import { SegmentedChoice } from '../components/ui/SegmentedChoice';
import {
  NumericAmountInput,
  OptionalMonthDayInput,
} from '../components/ui/NumericInputs';
import { createStarterEssential } from './setupIds';

export type SetupEssentialRowsProps = {
  rows: EssentialExpense[];
  onChange: (rows: EssentialExpense[]) => void;
  errors?: Record<string, string>;
};

export function SetupEssentialRows({ rows, onChange, errors }: SetupEssentialRowsProps) {
  const patch = (id: string, patchRow: Partial<EssentialExpense>) => {
    onChange(rows.map((x) => (x.id === id ? { ...x, ...patchRow } : x)));
  };

  const add = () => {
    onChange([...rows, createStarterEssential()]);
  };

  const remove = (id: string) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
        Add rent, utilities, groceries, and other regular bills. Weekly rows use 4 weeks per month in totals.
        Monthly due day defaults to the 15th if left blank.
      </p>
      {errors?._root ? (
        <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">
          {errors._root}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-600 dark:text-moss-muted">
              <th className="pb-2 pr-2">Name</th>
              <th className="pb-2 pr-2">Amount</th>
              <th className="pb-2 pr-2">Cadence</th>
              <th className="pb-2 pr-2">Due</th>
              <th className="pb-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ex) => (
              <tr key={ex.id} className="border-t border-slate-200/80 dark:border-moss-border">
                <td className="py-2 pr-2">
                  <input
                    className="w-full min-w-[8rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={ex.name}
                    onChange={(e) => patch(ex.id, { name: e.target.value })}
                    aria-invalid={Boolean(errors?.[`name-${ex.id}`])}
                  />
                </td>
                <td className="py-2 pr-2">
                  <NumericAmountInput
                    min={0}
                    className="w-full max-w-[7rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={ex.amount}
                    onValueChange={(n) => patch(ex.id, { amount: n })}
                  />
                </td>
                <td className="min-w-[12rem] py-2 pr-2 align-middle">
                  <SegmentedChoice
                    name={`setup-ess-cadence-${ex.id}`}
                    aria-label={`Cadence for ${ex.name}`}
                    size="compact"
                    value={ex.cadence}
                    options={ESSENTIAL_CADENCE_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
                    onChange={(v) => {
                      const cadence = v as EssentialExpense['cadence'];
                      patch(ex.id, {
                        cadence,
                        ...(cadence === 'week'
                          ? { dueDay: undefined, weeklyDueWeekday: ex.weeklyDueWeekday ?? 6 }
                          : { weeklyDueWeekday: undefined }),
                      });
                    }}
                  />
                </td>
                <td className="py-2 pr-2 align-middle">
                  {ex.cadence === 'month' ? (
                    <OptionalMonthDayInput
                      title="Day of month this bill is due"
                      className="w-full max-w-[4.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 tabular-nums dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      placeholder="15"
                      value={ex.dueDay}
                      onValueChange={(n) => patch(ex.id, { dueDay: n })}
                    />
                  ) : (
                    <ListboxSelect
                      ariaLabel={`Due weekday for ${ex.name}`}
                      popoverFixed
                      buttonClassName="min-w-0 w-full max-w-[9rem] rounded-lg px-2 py-1.5 text-xs shadow-none"
                      value={String(ex.weeklyDueWeekday ?? 6)}
                      options={[...WEEKLY_ESSENTIAL_DAY_OPTIONS]}
                      onChange={(v) => {
                        const d = Number(v);
                        if (!Number.isFinite(d) || d < 0 || d > 6) return;
                        patch(ex.id, { weeklyDueWeekday: d });
                      }}
                    />
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-600 underline hover:text-slate-900 disabled:opacity-40 dark:text-moss-muted dark:hover:text-moss-fg"
                    disabled={rows.length <= 1}
                    onClick={() => remove(ex.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-primary btn-primary-sm" onClick={add}>
        + Add bill / expense
      </button>
    </div>
  );
}
