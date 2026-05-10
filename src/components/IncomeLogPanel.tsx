import { useState } from 'react';
import type { FinanceState, IncomeEarner, IncomeLogEntry } from '../types/finance';
import { formatCalendarMonthHeading } from '../data/defaults';
import { INCOME_EARNER_OPTIONS, INCOME_EARNER_OPTIONS_SHORT } from '../data/selectOptions';
import { payLoggedVersusPlannedLine } from '../copy/payVsPlannedNotes';
import { incomeLogTip } from '../copy/tooltips';
import { expectedPaychequeForLoggedEarner, incomeLogOvertimeMonthTotal, overtimeOnIncomeLogRow } from '../utils/expectedPaycheque';
import { formatTrackingStartedHeading, isPreTrackingHistoryMonth } from '../utils/historyMonth';
import { incomeLogMonthTotal } from '../utils/incomeLog';
import { combinedMonthlyIncome } from '../utils/calculations';
import { formatMoney } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { ListboxSelect } from './ui/ListboxSelect';
import { NumericAmountInput } from './ui/NumericInputs';

const uid = (): string => Math.random().toString(36).slice(2, 10);

type IncomeLogPanelProps = {
  state: FinanceState;
  monthKey: string;
  onAdd: (e: IncomeLogEntry) => void;
  onRemove: (id: string) => void;
  onUpdateIncomeLog: (id: string, patch: Partial<IncomeLogEntry>) => void;
  /**
   * `dashboard` — this calendar month only; matches “Deposits recorded” upstairs.
   * `pastMonth` — whatever month is selected in Past months (closed months only).
   */
  variant?: 'dashboard' | 'pastMonth';
};

export function IncomeLogPanel({
  state,
  monthKey,
  onAdd,
  onRemove,
  onUpdateIncomeLog,
  variant = 'pastMonth',
}: IncomeLogPanelProps) {
  const planned = combinedMonthlyIncome(state);
  const logged = incomeLogMonthTotal(state, monthKey);
  const otEst = incomeLogOvertimeMonthTotal(state, monthKey);

  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState(800);
  const [earner, setEarner] = useState<IncomeEarner>('husband');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [editEarner, setEditEarner] = useState<IncomeEarner>('husband');
  const [editDate, setEditDate] = useState('');

  const monthEntries = state.incomeLog.filter((e) => {
    const d = new Date(e.date);
    const [y, m] = monthKey.split('-').map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  });

  /** Drops edit mode when the row leaves this History month or was removed — no effect sync needed. */
  const survivingEditingId =
    editingId != null && monthEntries.some((e) => e.id === editingId) ? editingId : null;

  const submit = () => {
    if (!label.trim() || !Number.isFinite(amount) || amount <= 0) return;
    onAdd({
      id: uid(),
      label: label.trim(),
      amount,
      earner,
      date,
    });
    setLabel('');
  };

  const earnerLabel = (e: IncomeEarner) =>
    e === 'husband' ? 'Husband' : e === 'wife' ? 'Wife' : 'Joint household';

  const startEdit = (e: IncomeLogEntry) => {
    setEditingId(e.id);
    setEditLabel(e.label);
    setEditAmount(e.amount);
    setEditEarner(e.earner);
    setEditDate(e.date);
  };

  const saveEdit = () => {
    if (!survivingEditingId || !editLabel.trim() || !Number.isFinite(editAmount) || editAmount <= 0) return;
    onUpdateIncomeLog(survivingEditingId, {
      label: editLabel.trim(),
      amount: editAmount,
      earner: editEarner,
      date: editDate,
    });
    setEditingId(null);
  };

  const wrapperId =
    variant === 'dashboard' ? 'income-log-this-month' : 'income-log-past-month';
  const title =
    variant === 'dashboard'
      ? 'Paycheque log — this calendar month'
      : 'Paycheque log — chosen past month';
  const subtitle =
    variant === 'dashboard'
      ? `Rows dated in ${formatCalendarMonthHeading(monthKey)} feed the Dashboard card “Deposits recorded (${monthKey})” above — same running total here. Planned income still comes from Household.`
      : `You’re editing deposits dated in ${formatCalendarMonthHeading(monthKey)} (${monthKey}) because that’s what the Past months picker chose. Current-month logging lives on the Dashboard — scroll back up — not here.`;

  return (
    <div id={wrapperId}>
      <HoverTip content={incomeLogTip()}>
        <div>
            <Card accent={variant === 'dashboard' ? 'emerald' : 'rose'} title={title} subtitle={subtitle}>
            <div className="mb-4 rounded-xl border-2 border-sage-400/40 bg-sage-50 px-3 py-2.5 text-xs font-semibold leading-snug text-sage-900 dark:border-moss-border dark:bg-moss-surface/80 dark:text-moss-subtle">
              <strong className="dark:text-moss-fg">Nothing auto-imports.</strong>{' '}
              {variant === 'dashboard'
                ? 'Everything you add here shows on the row list below immediately — totals also update the Dashboard snapshot.'
                : "Past bucket only — new rows dated in another month disappear from this table when they leave this month's bucket."}{' '}
              Change deposit date anytime to move a row between months.
            </div>
            <div className="rounded-2xl border border-sage-200/90 bg-white/80 p-4 dark:border-moss-border dark:bg-moss-surface/80">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs font-medium text-sage-600 dark:text-moss-muted">Planned monthly (Household)</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-sage-900 dark:text-moss-fg">
                    {formatMoney(planned)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-sage-600 dark:text-moss-muted">Logged ({monthKey})</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-sage-900 dark:text-moss-fg">
                    {formatMoney(logged)}
                  </p>
                  {logged > 0 && (
                    <>
                      {otEst > 0 && (
                        <p className="mt-1 text-xs text-teal-800 dark:text-teal-300/85">
                          Rough OT / extra on pay (vs usual cheque — set schedule in Household): {formatMoney(otEst)} · not the
                          same row as Extra cash &amp; gifts.
                        </p>
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-sage-700 dark:text-moss-subtle">
                        {payLoggedVersusPlannedLine(planned, logged)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl border border-sage-200/80 bg-sage-50/50 p-4 dark:border-moss-border dark:bg-moss-bg/60 md:grid-cols-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
                  What hit the account?
                  <input
                    className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. wife pay · husband OT…"
                  />
                </label>
                <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
                  Amount deposited
                  <NumericAmountInput
                    min={0}
                    commit="live"
                    hideZeroWhenBlurred={false}
                    className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg"
                    value={amount}
                    onValueChange={setAmount}
                  />
                </label>
                <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
                  Tagged for
                  <div className="mt-1">
                    <ListboxSelect
                      ariaLabel="Earner lane for this deposit"
                      buttonClassName="min-w-0 rounded-xl px-3 py-2 shadow-none"
                      value={earner}
                      options={[...INCOME_EARNER_OPTIONS]}
                      onChange={(v) => setEarner(v as IncomeEarner)}
                    />
                  </div>
                </label>
                <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
                  Deposit date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-col justify-end">
                <button type="button" onClick={submit} className="btn-primary">
                  Log this deposit
                </button>
                <p className="mt-2 text-xs text-sage-600 dark:text-moss-muted">
                  Each row sticks to whichever calendar month its <strong>deposit date</strong> falls in.
                  {variant === 'pastMonth'
                    ? ' Editing an old bucket here leaves the Dashboard (current month) alone unless you accidentally date a row into the future.'
                    : ' If you need April or another closed month, use Past months · Paycheque log down the page.'}
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-2 border-t border-sage-200/70 pt-4 dark:border-moss-border">
              {monthEntries.length === 0 && (
                <li className="text-sm text-sage-600 dark:text-moss-muted">
                  {isPreTrackingHistoryMonth(monthKey) ? (
                    <>
                      No paycheque rows here — placeholder before we started tracking in{' '}
                      {formatTrackingStartedHeading()}.
                    </>
                  ) : (
                    <>
                      Nothing logged with dates in {monthKey} yet — totals stay at zero for this month bucket.
                    </>
                  )}
                </li>
              )}
              {monthEntries.map((e) => {
                const ot = overtimeOnIncomeLogRow(state, e);
                const base = expectedPaychequeForLoggedEarner(state, e.earner);
                if (survivingEditingId === e.id) {
                  return (
                    <li
                      key={e.id}
                      className="rounded-xl border border-sage-300 bg-white px-3 py-3 dark:border-moss-border dark:bg-moss-elevated"
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
                          Label
                          <input
                            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                            value={editLabel}
                            onChange={(ev) => setEditLabel(ev.target.value)}
                          />
                        </label>
                        <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
                          Amount
                          <NumericAmountInput
                            min={0}
                            commit="live"
                            hideZeroWhenBlurred={false}
                            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                            value={editAmount}
                            onValueChange={setEditAmount}
                          />
                        </label>
                        <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
                          Earner
                          <div className="mt-1">
                            <ListboxSelect
                              ariaLabel="Earner lane for edited deposit"
                              buttonClassName="min-w-0 rounded-lg px-2 py-1.5 text-sm shadow-none"
                              value={editEarner}
                              options={[...INCOME_EARNER_OPTIONS_SHORT]}
                              onChange={(v) => setEditEarner(v as IncomeEarner)}
                            />
                          </div>
                        </label>
                        <label className="block text-xs font-medium text-sage-800 dark:text-moss-fg">
                          Date
                          <input
                            type="date"
                            className="mt-1 w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                            value={editDate}
                            onChange={(ev) => setEditDate(ev.target.value)}
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn-primary btn-primary-sm" onClick={saveEdit}>
                          Save edits
                        </button>
                        <button type="button" className="btn-secondary btn-secondary-sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2.5 text-sm dark:bg-moss-elevated/80"
                  >
                    <span className="font-medium text-sage-900 dark:text-moss-fg">{e.label}</span>
                    <span className="text-xs text-sage-600 dark:text-moss-muted">
                      {earnerLabel(e.earner)} · {e.date}
                      {e.earner !== 'joint' && base > 0 && (
                        <span className="block text-[0.65rem] text-sage-500 dark:text-moss-muted">
                          Baseline {formatMoney(base)}
                          {ot > 0 ? ` · ~${formatMoney(ot)} over baseline` : ''}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-sage-800 dark:text-moss-tip">{formatMoney(e.amount)}</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(e)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => {
                          if (survivingEditingId === e.id) setEditingId(null);
                          onRemove(e.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </HoverTip>
    </div>
  );
}
