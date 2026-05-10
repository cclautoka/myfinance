import type { ExtraIncomeEntry, FinanceState } from '../types/finance';
import { lifeThisMonthTip } from '../copy/tooltips';
import { ExtraIncome } from './ExtraIncome';
import { HoverTip } from './ui/HoverTip';

/** Extra cash this calendar month — surprise costs moved to Dashboard → Unexpected expenses section. */
export function LifeThisMonth({
  state,
  onAddExtra,
  onRemoveExtra,
}: {
  state: FinanceState;
  onAddExtra: (e: ExtraIncomeEntry) => void;
  onRemoveExtra: (id: string) => void;
}) {
  return (
    <HoverTip content={lifeThisMonthTip()}>
      <section
        id="finance-life-this-month"
        className="rounded-3xl border-[3px] border-sage-800/85 bg-white p-6 shadow-xl dark:border-moss-border dark:bg-moss-surface sm:p-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sage-600 dark:text-moss-muted">
            Still this month only
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-sage-900 dark:text-moss-fg sm:text-3xl">
            Extra cash that landed
          </h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-sage-700 dark:text-moss-subtle">
            Bonuses, gifts, side pickups — logged here. One‑off&nbsp;bills stay in the Unexpected expenses strip just below the dashboard.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <ExtraIncome state={state} onAdd={onAddExtra} onRemove={onRemoveExtra} />
        </div>
      </section>
    </HoverTip>
  );
}
