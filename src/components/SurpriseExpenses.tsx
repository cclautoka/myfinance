import { useState } from 'react';
import type { FinanceState, SurpriseCategory, SurpriseExpenseEntry } from '../types/finance';
import { SURPRISE_CATEGORY_OPTIONS } from '../data/selectOptions';
import { formatMoney } from '../utils/format';
import { ListboxSelect } from './ui/ListboxSelect';
import { NumericAmountInput } from './ui/NumericInputs';

const uid = (): string => Math.random().toString(36).slice(2, 10);

const categoryLabels: Record<SurpriseCategory, string> = {
  car_repair: 'Car / transport',
  medical: 'Health',
  home: 'Home / repairs',
  travel: 'Travel',
  family: 'Family / kids',
  other: 'Something else',
};

export function SurpriseExpenses({
  state,
  onAdd,
  onRemove,
}: {
  state: FinanceState;
  onAdd: (e: SurpriseExpenseEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(50);
  const [category, setCategory] = useState<SurpriseCategory>('other');
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
        Surprise costs
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        Life throws curveballs. Writing them down here is only so you remember what happened — not
        because you did anything wrong.
      </p>

      <div className="mt-4 rounded-2xl border border-sage-200/80 bg-white/80 p-4 dark:border-moss-border dark:bg-moss-elevated/80">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
            What was it?
            <input
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. dentist, new tyres, school trip…"
            />
          </label>
        <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
          Roughly how much?
          <NumericAmountInput
            min={0}
            commit="live"
            hideZeroWhenBlurred={false}
            className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={amount}
            onValueChange={setAmount}
          />
          </label>
          <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
            Category
            <div className="mt-1">
              <ListboxSelect
                ariaLabel="Surprise cost category"
                buttonClassName="min-w-0 rounded-xl px-3 py-2 shadow-none"
                value={category}
                options={[...SURPRISE_CATEGORY_OPTIONS]}
                onChange={(v) => setCategory(v as SurpriseCategory)}
              />
            </div>
          </label>
          <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
            When
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <button type="button" onClick={submit} className="btn-primary mt-4">
          Save this surprise
        </button>
      </div>

      <ul className="mt-5 space-y-2 border-t border-sage-200/70 pt-4 dark:border-moss-border">
        {state.surpriseExpenses.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm dark:bg-moss-surface"
          >
            <span className="font-medium text-sage-900 dark:text-moss-fg">{e.label}</span>
            <span className="text-sage-600 dark:text-moss-muted">
              {categoryLabels[e.category]} · {e.date}
            </span>
            <span className="font-semibold text-sage-800 dark:text-moss-tip">{formatMoney(e.amount)}</span>
            <button type="button" className="btn-ghost text-xs" onClick={() => onRemove(e.id)}>
              Remove
            </button>
          </li>
        ))}
        {state.surpriseExpenses.length === 0 && (
          <li className="text-sm text-sage-600 dark:text-moss-muted">Nothing logged yet — that is okay.</li>
        )}
      </ul>
    </div>
  );
}
