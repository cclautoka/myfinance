import { useMemo, useState } from 'react';
import type { SavingsGoal } from '../types/finance';
import { NumericAmountInput } from '../components/ui/NumericInputs';
import { newSetupId } from './setupIds';

export function createStarterSavingsGoal(): SavingsGoal {
  return { id: newSetupId('goal'), name: '', targetAmount: 0, balance: 0 };
}

export type SetupSavingsGoalsRowsProps = {
  rows: SavingsGoal[];
  onChange: (rows: SavingsGoal[]) => void;
  errors?: Record<string, string>;
};

export function SetupSavingsGoalsRows({ rows, onChange, errors }: SetupSavingsGoalsRowsProps) {
  const [manualAdds, setManualAdds] = useState<Record<string, number>>({});

  const patch = (id: string, patchRow: Partial<SavingsGoal>) => {
    onChange(rows.map((x) => (x.id === id ? { ...x, ...patchRow } : x)));
  };

  const addToBalance = (id: string, delta: number) => {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const row = rows.find((x) => x.id === id);
    if (!row) return;
    patch(id, { balance: Math.max(0, (Number(row.balance) || 0) + delta) });
  };

  const manualDefault = useMemo(() => 200, []);

  const add = () => onChange([...rows, createStarterSavingsGoal()]);

  const remove = (id: string) => onChange(rows.filter((x) => x.id !== id));

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
        Name your own targets (holiday, school fees, new car). Progress rings on Plan and the Dashboard use these —
        not a preset 3-month cushion.
      </p>
      {errors?._root ? (
        <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">
          {errors._root}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-moss-muted">No goals yet — add one or skip for now.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((g) => (
            <li
              key={g.id}
              className="grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 sm:grid-cols-2 dark:border-moss-border dark:bg-moss-bg/40"
            >
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted sm:col-span-2">
                Goal name
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  placeholder="e.g. Holiday fund"
                  value={g.name}
                  onChange={(e) => patch(g.id, { name: e.target.value })}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Target ($)
                <NumericAmountInput
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  value={g.targetAmount}
                  onValueChange={(n) => patch(g.id, { targetAmount: n })}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Saved so far ($)
                <NumericAmountInput
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  value={g.balance}
                  onValueChange={(n) => patch(g.id, { balance: n })}
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {[25, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn-secondary btn-secondary-sm"
                    onClick={() => addToBalance(g.id, n)}
                  >
                    +${n}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn-secondary btn-secondary-sm"
                  onClick={() => addToBalance(g.id, 500)}
                >
                  +$500
                </button>
                <div className="flex items-center gap-2">
                  <NumericAmountInput
                    min={0}
                    className="w-[7.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={manualAdds[g.id] ?? manualDefault}
                    onValueChange={(n) => setManualAdds((m) => ({ ...m, [g.id]: n }))}
                  />
                  <button
                    type="button"
                    className="btn-primary btn-primary-sm"
                    onClick={() => {
                      const n = Number(manualAdds[g.id] ?? manualDefault);
                      addToBalance(g.id, n);
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-moss-muted"
                  onClick={() => remove(g.id)}
                >
                  Remove goal
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-primary btn-primary-sm" onClick={add}>
        + Add savings goal
      </button>
    </div>
  );
}
