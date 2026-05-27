import { useMemo, useState } from 'react';
import type {
  ExtraIncomeCategory,
  ExtraIncomeEntry,
  FinanceState,
  SurpriseCategory,
  SurpriseExpenseEntry,
  SurprisePaidByRole,
} from '../types/finance';
import { pastMonthInsightsTip } from '../copy/tooltips';
import {
  formatCalendarMonthHeading,
  parseCalendarMonthKey,
} from '../data/defaults';
import { extraIncomeMonthTotal, surpriseExpensesMonthTotal } from '../utils/calculations';
import type { BillsPaidTogglePayload } from '../utils/billsTimeline';
import { billsHandledBreakdownForMonth } from '../utils/billsTimeline';
import { incomeLogOvertimeMonthTotal } from '../utils/expectedPaycheque';
import { incomeLogMonthTotal } from '../utils/incomeLog';
import { formatMoney, formatShortDate } from '../utils/format';
import { defaultSurprisePaidByRole, SURPRISE_PAID_BY_OPTIONS } from '../utils/surprisePaidBy';
import { Card } from './ui/Card';
import { EXTRA_INCOME_CATEGORY_OPTIONS, SURPRISE_CATEGORY_OPTIONS } from '../data/selectOptions';
import { BillPaymentMarkControls } from './BillPaymentMarkControls';
import { HoverTip } from './ui/HoverTip';
import { ListboxSelect } from './ui/ListboxSelect';
import { NumericAmountInput } from './ui/NumericInputs';
import { formatTrackingStartedHeading, isPreTrackingHistoryMonth } from '../utils/historyMonth';

const uid = (): string => Math.random().toString(36).slice(2, 10);

/** Mid-month anchor for backdating rows into a chosen Past month picker. */
function defaultDateInMonth(monthKey: string): string {
  const p = parseCalendarMonthKey(monthKey);
  if (!p) return new Date().toISOString().slice(0, 10);
  const lastDom = new Date(p.year, p.monthIndex + 1, 0).getDate();
  const dom = Math.min(15, lastDom);
  return `${p.year}-${String(p.monthIndex + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
}

function entryInCalendarMonth(dateStr: string, monthKey: string): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return mk === monthKey;
}

/** Remount editors when persisted fields change (no setState-in-effect sync). */
function extraRowPersistKey(e: ExtraIncomeEntry) {
  return `${e.id}:${e.label}:${e.amount}:${e.date}:${e.category}`;
}

function surpriseRowPersistKey(e: SurpriseExpenseEntry) {
  return `${e.id}:${e.label}:${e.amount}:${e.date}:${e.category}`;
}

function ExtraRow({
  e,
  onSave,
  onRemove,
}: {
  e: ExtraIncomeEntry;
  onSave: (id: string, patch: Partial<ExtraIncomeEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState(e.label);
  const [amount, setAmount] = useState(e.amount);
  const [date, setDate] = useState(e.date);
  const [category, setCategory] = useState(e.category);
  return (
    <li className="grid gap-2 rounded-xl border border-sage-200/80 bg-white/80 p-3 dark:border-moss-border dark:bg-moss-elevated sm:grid-cols-2">
      <input
        className="rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
        value={label}
        onChange={(ev) => setLabel(ev.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <NumericAmountInput
          min={0}
          commit="live"
          hideZeroWhenBlurred={false}
          className="w-28 rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
          value={amount}
          onValueChange={setAmount}
        />
        <input
          type="date"
          className="rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
        />
        <ListboxSelect
          ariaLabel="Extra cash category"
          popoverFixed
          buttonClassName="min-w-0 shrink-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
          value={category}
          options={[...EXTRA_INCOME_CATEGORY_OPTIONS]}
          onChange={(v) => setCategory(v as ExtraIncomeEntry['category'])}
        />
        <button
          type="button"
          className="btn-secondary btn-secondary-sm"
          onClick={() => onSave(e.id, { label: label.trim(), amount, date, category })}
        >
          Save row
        </button>
        <button type="button" className="btn-ghost btn-secondary-sm text-xs" onClick={() => onRemove(e.id)}>
          Remove
        </button>
      </div>
    </li>
  );
}

function SurpriseRow({
  e,
  onSave,
  onRemove,
}: {
  e: SurpriseExpenseEntry;
  onSave: (id: string, patch: Partial<SurpriseExpenseEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState(e.label);
  const [amount, setAmount] = useState(e.amount);
  const [date, setDate] = useState(e.date);
  const [category, setCategory] = useState(e.category);
  const [paidByRole, setPaidByRole] = useState<SurprisePaidByRole>(e.paidByRole ?? 'owner');
  return (
    <li className="grid gap-2 rounded-xl border border-sage-200/80 bg-white/80 p-3 dark:border-moss-border dark:bg-moss-elevated sm:grid-cols-2">
      <input
        className="rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
        value={label}
        onChange={(ev) => setLabel(ev.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <NumericAmountInput
          min={0}
          commit="live"
          hideZeroWhenBlurred={false}
          className="w-28 rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
          value={amount}
          onValueChange={setAmount}
        />
        <input
          type="date"
          className="rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
        />
        <ListboxSelect
          ariaLabel="Surprise paid by"
          popoverFixed
          buttonClassName="min-w-[8rem] shrink-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
          value={paidByRole}
          options={SURPRISE_PAID_BY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => setPaidByRole(v as SurprisePaidByRole)}
        />
        <ListboxSelect
          ariaLabel="Surprise expense category"
          popoverFixed
          buttonClassName="min-w-[10rem] shrink-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
          value={category}
          options={[...SURPRISE_CATEGORY_OPTIONS]}
          onChange={(v) => setCategory(v as SurpriseExpenseEntry['category'])}
        />
        <button
          type="button"
          className="btn-secondary btn-secondary-sm"
          onClick={() => onSave(e.id, { label: label.trim(), amount, date, category, paidByRole })}
        >
          Save row
        </button>
        <button type="button" className="btn-ghost btn-secondary-sm text-xs" onClick={() => onRemove(e.id)}>
          Remove
        </button>
      </div>
    </li>
  );
}

function PastMonthRetroCashForms({
  monthKey,
  onAddExtra,
  onAddSurprise,
}: {
  monthKey: string;
  onAddExtra: (e: ExtraIncomeEntry) => void;
  onAddSurprise: (e: SurpriseExpenseEntry) => void;
}) {
  const [exLabel, setExLabel] = useState('');
  const [exAmount, setExAmount] = useState(100);
  const [exCategory, setExCategory] = useState<ExtraIncomeCategory>('bonus');
  const [exDate, setExDate] = useState(() => defaultDateInMonth(monthKey));
  const [suLabel, setSuLabel] = useState('');
  const [suAmount, setSuAmount] = useState(50);
  const [suCategory, setSuCategory] = useState<SurpriseCategory>('other');
  const [suPaidBy, setSuPaidBy] = useState<SurprisePaidByRole>(() => defaultSurprisePaidByRole());
  const [suDate, setSuDate] = useState(() => defaultDateInMonth(monthKey));
  const [hint, setHint] = useState<string | null>(null);

  const submitExtra = () => {
    if (!exLabel.trim() || exAmount <= 0) return;
    if (!entryInCalendarMonth(exDate, monthKey)) {
      setHint(`Extra cash date must fall in ${monthKey} so it sits in this month bucket.`);
      return;
    }
    setHint(null);
    onAddExtra({
      id: uid(),
      label: exLabel.trim(),
      amount: exAmount,
      category: exCategory,
      date: exDate,
    });
    setExLabel('');
  };

  const submitSurprise = () => {
    if (!suLabel.trim() || suAmount <= 0) return;
    if (!entryInCalendarMonth(suDate, monthKey)) {
      setHint(`Surprise date must fall in ${monthKey} so it sits in this month bucket.`);
      return;
    }
    setHint(null);
    onAddSurprise({
      id: uid(),
      label: suLabel.trim(),
      amount: suAmount,
      category: suCategory,
      date: suDate,
      paidByRole: suPaidBy,
    });
    setSuLabel('');
  };

  return (
    <div className="mt-6 border-t border-sage-200/70 pt-4 dark:border-moss-border">
      <p className="text-sm font-semibold text-sage-900 dark:text-moss-fg">
        Log extra cash &amp; surprise costs for {formatCalendarMonthHeading(monthKey)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
        Same fields as the Dashboard block — here the date defaults inside the month you picked. You can still change the day; it
        must stay in this calendar month. Current-month logging stays on the Dashboard.
      </p>
      {hint && (
        <p className="mt-2 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
          {hint}
        </p>
      )}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-sage-200/80 bg-sage-50/40 p-4 dark:border-moss-border dark:bg-moss-bg/40">
          <p className="text-xs font-bold uppercase tracking-wide text-sage-700 dark:text-moss-muted">Extra cash</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg sm:col-span-2">
              Label
              <input
                className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={exLabel}
                onChange={(ev) => setExLabel(ev.target.value)}
                placeholder="e.g. bonus, gift…"
              />
            </label>
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
              Amount
              <NumericAmountInput
                min={0}
                commit="live"
                hideZeroWhenBlurred={false}
                className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={exAmount}
                onValueChange={setExAmount}
              />
            </label>
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
              Date in {monthKey}
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={exDate}
                onChange={(ev) => setExDate(ev.target.value)}
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-sage-800 dark:text-moss-fg">Type</p>
              <div className="mt-1">
                <ListboxSelect
                  ariaLabel="Extra cash category for past month"
                  popoverFixed
                  buttonClassName="min-w-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
                  value={exCategory}
                  options={[...EXTRA_INCOME_CATEGORY_OPTIONS]}
                  onChange={(v) => setExCategory(v as ExtraIncomeCategory)}
                />
              </div>
            </div>
          </div>
          <button type="button" className="btn-primary btn-primary-sm mt-3" onClick={submitExtra}>
            Add to this month
          </button>
        </div>
        <div className="rounded-xl border border-sage-200/80 bg-sage-50/40 p-4 dark:border-moss-border dark:bg-moss-bg/40">
          <p className="text-xs font-bold uppercase tracking-wide text-sage-700 dark:text-moss-muted">Surprise cost</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg sm:col-span-2">
              Label
              <input
                className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={suLabel}
                onChange={(ev) => setSuLabel(ev.target.value)}
                placeholder="e.g. vet, repair…"
              />
            </label>
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
              Amount
              <NumericAmountInput
                min={0}
                commit="live"
                hideZeroWhenBlurred={false}
                className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={suAmount}
                onValueChange={setSuAmount}
              />
            </label>
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
              Date in {monthKey}
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                value={suDate}
                onChange={(ev) => setSuDate(ev.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
              Paid by
              <div className="mt-1">
                <ListboxSelect
                  ariaLabel="Surprise paid by for past month"
                  popoverFixed
                  buttonClassName="min-w-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
                  value={suPaidBy}
                  options={SURPRISE_PAID_BY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(v) => setSuPaidBy(v as SurprisePaidByRole)}
                />
              </div>
            </label>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-sage-800 dark:text-moss-fg">Category</p>
              <div className="mt-1">
                <ListboxSelect
                  ariaLabel="Surprise category for past month"
                  popoverFixed
                  buttonClassName="min-w-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
                  value={suCategory}
                  options={[...SURPRISE_CATEGORY_OPTIONS]}
                  onChange={(v) => setSuCategory(v as SurpriseCategory)}
                />
              </div>
            </div>
          </div>
          <button type="button" className="btn-primary btn-primary-sm mt-3" onClick={submitSurprise}>
            Add to this month
          </button>
        </div>
      </div>
    </div>
  );
}

export function PastMonthInsights({
  state,
  monthKey,
  onRetroMarkHandled,
  onUpdateExtra,
  onUpdateSurprise,
  onAddExtra,
  onRemoveExtra,
  onAddSurprise,
  onRemoveSurprise,
}: {
  state: FinanceState;
  monthKey: string;
  onRetroMarkHandled: (row: BillsPaidTogglePayload) => void;
  onUpdateExtra: (id: string, patch: Partial<ExtraIncomeEntry>) => void;
  onUpdateSurprise: (id: string, patch: Partial<SurpriseExpenseEntry>) => void;
  onAddExtra: (e: ExtraIncomeEntry) => void;
  onRemoveExtra: (id: string) => void;
  onAddSurprise: (e: SurpriseExpenseEntry) => void;
  onRemoveSurprise: (id: string) => void;
}) {
  const billStats = useMemo(() => billsHandledBreakdownForMonth(state, monthKey), [state, monthKey]);
  const logged = incomeLogMonthTotal(state, monthKey);
  const otEst = incomeLogOvertimeMonthTotal(state, monthKey);
  const extras = extraIncomeMonthTotal(state, monthKey);
  const surprisesTot = surpriseExpensesMonthTotal(state, monthKey);

  const extrasRows = state.extraIncome.filter((e) => entryInCalendarMonth(e.date, monthKey));
  const surpriseRows = state.surpriseExpenses.filter((e) => entryInCalendarMonth(e.date, monthKey));

  const missedCap = 12;

  return (
    <HoverTip content={pastMonthInsightsTip()}>
      <div>
        <Card
          title={`${formatCalendarMonthHeading(monthKey)} · recap`}
          subtitle="Bill checklist (mark handled), paycheque log below, extra cash & surprise costs — all scoped to this picker month. Current month uses the Dashboard instead."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-sage-200/80 bg-sage-50/50 p-3 dark:border-moss-border dark:bg-moss-surface/80">
              <p className="text-xs text-sage-600 dark:text-moss-muted">Bill lines marked handled</p>
              <p className="mt-1 font-display text-xl font-semibold text-sage-900 dark:text-moss-fg">
                {billStats.handled} / {billStats.total}
              </p>
            </div>
            <div className="rounded-xl border border-sage-200/80 bg-sage-50/50 p-3 dark:border-moss-border dark:bg-moss-surface/80">
              <p className="text-xs text-sage-600 dark:text-moss-muted">Pay logged</p>
              <p className="mt-1 font-display text-xl font-semibold text-sage-900 dark:text-moss-fg">
                {formatMoney(logged)}
              </p>
            </div>
            <div className="rounded-xl border border-sage-200/80 bg-sage-50/50 p-3 dark:border-moss-border dark:bg-moss-surface/80">
              <p className="text-xs text-sage-600 dark:text-moss-muted">Extra cash (logged dates)</p>
              <p className="mt-1 font-display text-xl font-semibold text-sage-900 dark:text-moss-fg">
                {formatMoney(extras)}
              </p>
            </div>
            <div className="rounded-xl border border-sage-200/80 bg-sage-50/50 p-3 dark:border-moss-border dark:bg-moss-surface/80">
              <p className="text-xs text-sage-600 dark:text-moss-muted">Surprise costs</p>
              <p className="mt-1 font-display text-xl font-semibold text-sage-900 dark:text-moss-fg">
                {formatMoney(surprisesTot)}
              </p>
            </div>
          </div>
          {otEst > 0 && (
            <p className="mt-4 text-xs text-teal-800 dark:text-teal-300/85">
              Rough cheque OT / extra (vs usual pay) this month: {formatMoney(otEst)} · updates if you edit Paycheque log rows.
            </p>
          )}

          <p className="mt-6 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
            <strong className="text-sage-900 dark:text-moss-fg">Carry‑over?</strong> Nothing unpaid is auto-moved into next
            month’s math. A line stays “needs a look” on the timeline if it&apos;s overdue and still not checked. Changing Household
            plans (income, bills, sliders) reapplies instantly everywhere projections use them. Fixing an old month&apos;s deposits or
            extras only changes totals <em>when you&apos;re viewing that month</em> here and in CSV — plus anything that aggregates
            those dated rows elsewhere.
          </p>

          {billStats.missed.length > 0 && (
            <div className="mt-6 border-t border-sage-200/70 pt-4 dark:border-moss-border">
              <p className="text-sm font-semibold text-sage-900 dark:text-moss-fg">
                Not marked handled (by due date this month){' '}
                <span className="font-normal text-sage-600 dark:text-moss-muted">— catch up anytime</span>
              </p>
              <ul className="mt-3 space-y-2">
                {billStats.missed.slice(0, missedCap).map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border border-sage-200/80 bg-white/90 px-3 py-3 text-sm dark:border-moss-border dark:bg-moss-surface sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sage-900 dark:text-moss-fg">{b.name}</p>
                      <p className="mt-0.5 text-xs text-sage-600 dark:text-moss-muted">
                        {formatShortDate(b.due)} · Plan {formatMoney(b.amount)}
                      </p>
                    </div>
                    <BillPaymentMarkControls
                      occurrenceKey={b.id}
                      toggleTarget={{
                        billId: b.billId,
                        due: b.due,
                        category: b.category,
                        label: b.name,
                      }}
                      plannedAmount={b.amount}
                      isPaid={false}
                      displayPaidAmount={b.amount}
                      onToggle={onRetroMarkHandled}
                      compact
                    />
                  </li>
                ))}
              </ul>
              {billStats.missed.length > missedCap && (
                <p className="mt-2 text-xs text-sage-600 dark:text-moss-muted">
                  Showing first {missedCap} of {billStats.missed.length}.
                </p>
              )}
            </div>
          )}

          {isPreTrackingHistoryMonth(monthKey) ? (
            <p className="mt-6 border-t border-sage-200/70 pt-4 text-sm leading-relaxed text-sage-600 dark:border-moss-border dark:text-moss-muted">
              Extra cash, surprise costs, bill checkmarks, and paycheque rows are intentionally empty here — household tracking starts{' '}
              <strong className="text-sage-900 dark:text-moss-fg">{formatTrackingStartedHeading()}</strong>. Use Past months on or
              after that month to backfill; use the Dashboard for the current calendar month.
            </p>
          ) : (
            <>
              <PastMonthRetroCashForms
                key={monthKey}
                monthKey={monthKey}
                onAddExtra={onAddExtra}
                onAddSurprise={onAddSurprise}
              />
              {(extrasRows.length > 0 || surpriseRows.length > 0) && (
                <div className="mt-6 border-t border-sage-200/70 pt-4 dark:border-moss-border">
                  <p className="text-sm font-semibold text-sage-900 dark:text-moss-fg">
                    Edit or remove dated entries ({monthKey}) — totals above update when you save.
                  </p>
                  {extrasRows.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-sage-700 dark:text-moss-muted">Extra cash</p>
                      <ul className="mt-2 space-y-3">
                        {extrasRows.map((e) => (
                          <ExtraRow
                            key={extraRowPersistKey(e)}
                            e={e}
                            onSave={onUpdateExtra}
                            onRemove={onRemoveExtra}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                  {surpriseRows.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-medium text-sage-700 dark:text-moss-muted">Surprise costs</p>
                      <ul className="mt-2 space-y-3">
                        {surpriseRows.map((e) => (
                          <SurpriseRow
                            key={surpriseRowPersistKey(e)}
                            e={e}
                            onSave={onUpdateSurprise}
                            onRemove={onRemoveSurprise}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </HoverTip>
  );
}
