import { useState } from 'react';
import type { ExtraIncomeCategory, ExtraIncomeEntry, FinanceState } from '../types/finance';
import { EXTRA_INCOME_CATEGORY_OPTIONS } from '../data/selectOptions';
import { formatMoney } from '../utils/format';
import { ListboxSelect } from './ui/ListboxSelect';
import { NumericAmountInput } from './ui/NumericInputs';

const uid = (): string => Math.random().toString(36).slice(2, 10);

export function ExtraIncome({
  state,
  onAdd,
  onRemove,
}: {
  state: FinanceState;
  onAdd: (e: ExtraIncomeEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(100);
  const [category, setCategory] = useState<ExtraIncomeCategory>('bonus');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const submit = () => {
    if (!label.trim() || amount <= 0) return;
    onAdd({
      id: uid(),
      label: label.trim(),
      amount,
      category,
      date,
    });
    setLabel('');
  };

  return (
    <div className="rounded-2xl border border-sage-200/90 bg-gradient-to-br from-sage-50/90 to-white p-5 dark:border-moss-border dark:from-moss-surface dark:to-moss-bg">
      <h3 className="font-display text-lg font-semibold text-sage-900 dark:text-moss-fg">
        Extra cash that came in
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        Odd bonuses, rebates, gig cash —{' '}
        <strong className="text-sage-900 dark:text-moss-fg">this ledger is what folds into totals and recap</strong>. Paycheque log
        may <em>estimate</em> overtime vs usual cheque; recording the same dollars here keeps the story in your month numbers on
        purpose.
      </p>

      <div className="mt-4 rounded-2xl border border-sage-200/80 bg-white/80 p-4 dark:border-moss-border dark:bg-moss-elevated/80">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium text-sage-800 dark:text-moss-fg sm:col-span-2">
            What was it?
            <input
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. bonus payout, rebate, gig…"
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-sage-800 dark:text-moss-fg">
            How much?
            <NumericAmountInput
              min={0}
              commit="live"
              hideZeroWhenBlurred={false}
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={amount}
              onValueChange={setAmount}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-sage-800 dark:text-moss-fg">
            Date
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-sage-800 dark:text-moss-fg">
            Type
            <div className="mt-1 min-w-0">
              <ListboxSelect
                ariaLabel="Extra cash type"
                buttonClassName="min-w-0 max-w-full rounded-xl px-3 py-2 shadow-none"
                value={category}
                options={[...EXTRA_INCOME_CATEGORY_OPTIONS]}
                onChange={(v) => setCategory(v as ExtraIncomeCategory)}
              />
            </div>
          </label>
        </div>
        <button type="button" onClick={submit} className="btn-primary mt-4">
          Log this extra
        </button>
      </div>

      <ul className="mt-5 space-y-2 border-t border-sage-200/70 pt-4 dark:border-moss-border">
        {state.extraIncome.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm dark:bg-moss-surface"
          >
            <span className="font-medium text-sage-900 dark:text-moss-fg">{e.label}</span>
            <span className="text-sage-600 dark:text-moss-muted">
              {e.category} · {e.date}
            </span>
            <span className="font-semibold text-sage-800 dark:text-moss-tip">{formatMoney(e.amount)}</span>
            <button type="button" className="btn-ghost text-xs" onClick={() => onRemove(e.id)}>
              Remove
            </button>
          </li>
        ))}
        {state.extraIncome.length === 0 && (
          <li className="text-sm text-sage-600 dark:text-moss-muted">Nothing here yet — totally fine.</li>
        )}
      </ul>
    </div>
  );
}
