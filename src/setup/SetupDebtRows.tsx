import type { DebtAccount, DebtKind } from '../types/finance';
import { SegmentedChoice } from '../components/ui/SegmentedChoice';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';
import {
  NumericAmountInput,
  NumericIntegerInput,
} from '../components/ui/NumericInputs';
import { createStarterDebt } from './setupIds';

const DEBT_KIND_SEGMENT: { id: DebtKind; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'installment', label: 'HP' },
  { id: 'loan', label: 'Loan' },
  { id: 'personal', label: 'Personal' },
];

export type SetupDebtRowsProps = {
  rows: DebtAccount[];
  onChange: (rows: DebtAccount[]) => void;
  errors?: Record<string, string>;
};

export function SetupDebtRows({ rows, onChange, errors }: SetupDebtRowsProps) {
  const patch = (id: string, patchRow: Partial<DebtAccount>) => {
    onChange(rows.map((x) => (x.id === id ? { ...x, ...patchRow } : x)));
  };

  const add = () => {
    onChange([...rows, createStarterDebt()]);
  };

  const remove = (id: string) => {
    onChange(rows.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
        Balance is what you type from the bank. Optional APR % only powers a rough interest hint — it does not
        change stored balances.
      </p>
      {errors?._root ? (
        <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">
          {errors._root}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-600 dark:text-moss-muted">
              <th className="pb-2 pr-2">Type</th>
              <th className="pb-2 pr-2">Name</th>
              <th className="pb-2 pr-2">Balance</th>
              <th className="pb-2 pr-2">APR %</th>
              <th className="pb-2 pr-2">Payment</th>
              <th className="pb-2 pr-2">Due day</th>
              <th className="pb-2 pr-2">Auto</th>
              <th className="pb-2 pr-2">Ends (ISO)</th>
              <th className="pb-2 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-slate-200/80 dark:border-moss-border">
                <td className="min-w-[13rem] py-2 pr-2 align-middle">
                  <SegmentedChoice
                    name={`setup-debt-kind-${d.id}`}
                    aria-label={`Account type for ${d.name}`}
                    size="compact"
                    value={d.kind}
                    options={DEBT_KIND_SEGMENT}
                    onChange={(v) => patch(d.id, { kind: v as DebtKind })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={d.name}
                    onChange={(e) => patch(d.id, { name: e.target.value })}
                    aria-invalid={Boolean(errors?.[`name-${d.id}`])}
                  />
                </td>
                <td className="py-2 pr-2">
                  <NumericAmountInput
                    min={0}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={d.balance}
                    onValueChange={(n) => patch(d.id, { balance: n })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <NumericAmountInput
                    min={0}
                    max={60}
                    placeholder="—"
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={d.annualInterestApr ?? 0}
                    onValueChange={(n) => patch(d.id, { annualInterestApr: Math.max(0, n) })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <NumericAmountInput
                    min={0}
                    className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={d.monthlyPayment}
                    onValueChange={(n) => patch(d.id, { monthlyPayment: n })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <NumericIntegerInput
                    min={1}
                    max={31}
                    emptyBlurRestoresCurrent
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 tabular-nums dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={d.dueDay}
                    onValueChange={(n) => patch(d.id, { dueDay: n })}
                  />
                </td>
                <td className="min-w-[7rem] py-2 pr-2 align-middle">
                  <SegmentedToggle
                    name={`setup-debt-auto-${d.id}`}
                    aria-label={`Auto-deduct ${d.name || 'debt'}`}
                    size="compact"
                    offLabel="Off"
                    onLabel="Auto"
                    checked={Boolean(d.autoDeduction)}
                    onCheckedChange={(on) => patch(d.id, { autoDeduction: on })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={d.endsOn ?? ''}
                    placeholder="YYYY-MM-DD"
                    onChange={(e) => patch(d.id, { endsOn: e.target.value || null })}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-moss-muted dark:hover:text-moss-fg"
                    onClick={() => remove(d.id)}
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
        + Add loan / HP / payment
      </button>
    </div>
  );
}
