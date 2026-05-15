import type { OtherPlannedIncomeEntry } from '../types/finance';
import { NumericAmountInput } from '../components/ui/NumericInputs';
import { newSetupId } from './setupIds';

export function createStarterOtherIncome(): OtherPlannedIncomeEntry {
  return { id: newSetupId('other-inc'), label: '', amount: 0 };
}

export type SetupOtherIncomeRowsProps = {
  rows: OtherPlannedIncomeEntry[];
  onChange: (rows: OtherPlannedIncomeEntry[]) => void;
};

export function SetupOtherIncomeRows({ rows, onChange }: SetupOtherIncomeRowsProps) {
  const patch = (id: string, patchRow: Partial<OtherPlannedIncomeEntry>) => {
    onChange(rows.map((x) => (x.id === id ? { ...x, ...patchRow } : x)));
  };

  const add = () => onChange([...rows, createStarterOtherIncome()]);

  const remove = (id: string) => onChange(rows.filter((x) => x.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
        Optional — add as many steady sources as you need (rental, benefits, side gig). Each amount is included in
        planned monthly income on the Dashboard and money-split charts.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-moss-muted">No extra sources yet — tap below if you have any.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2 dark:border-moss-border dark:bg-moss-bg/40"
            >
              <label className="min-w-[10rem] flex-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Label
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  placeholder="e.g. Rental property"
                  value={row.label}
                  onChange={(e) => patch(row.id, { label: e.target.value })}
                />
              </label>
              <label className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Monthly ($)
                <NumericAmountInput
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  value={row.amount}
                  onValueChange={(n) => patch(row.id, { amount: n })}
                />
              </label>
              <button
                type="button"
                className="mb-1 text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-moss-muted"
                onClick={() => remove(row.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-secondary btn-secondary-sm" onClick={add}>
        + Add consistent income
      </button>
    </div>
  );
}
