import { useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { HoverTip } from './ui/HoverTip';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';
import { NumericAmountInput } from './ui/NumericInputs';
import { currentMonthKey } from '../data/defaults';
import { formatMoney, formatShortDate } from '../utils/format';
import {
  monthActualExpenseTotal,
  monthActualIncomeTotal,
  monthActualNetCashflow,
  monthAdjustedNetCashflow,
  monthCashflowBreakdownLines,
  monthSpendableCarry,
  monthTotalSpendableIncome,
  surplusSweepRoomRemaining,
  totalSurplusSweptForMonth,
} from '../utils/budgetSurplus';

function parseCashflowDate(d: string): Date {
  return new Date(d.length === 10 ? `${d}T12:00:00` : d);
}

export function BudgetSurplusPanel({
  state,
  onSweepToEmergency,
  onSetMonthSpendableCarry,
}: {
  state: FinanceState;
  onSweepToEmergency: (amount: number) => void;
  onSetMonthSpendableCarry: (monthKey: string, amount: number) => void;
}) {
  const mk = currentMonthKey();
  const carryStored = monthSpendableCarry(state, mk);
  const incomeLogged = monthActualIncomeTotal(state, mk);
  const incomeTotal = monthTotalSpendableIncome(state, mk);
  const expenseActual = monthActualExpenseTotal(state, mk);
  const netLoggedOnly = monthActualNetCashflow(state, mk);
  const netWithCarry = monthAdjustedNetCashflow(state, mk);
  const swept = totalSurplusSweptForMonth(state, mk);
  const remaining = surplusSweepRoomRemaining(state, mk);
  const goalMet = state.emergencyFund >= Math.max(state.threeMonthFundTarget, 1);
  const [draft, setDraft] = useState('');

  const sweepsLines = useMemo(
    () => (state.budgetSurplusSweeps ?? []).filter((e) => e.monthKey === mk),
    [state.budgetSurplusSweeps, mk],
  );

  const carryInputKey = `carry-${mk}-${String(state.monthSpendableCarryByMonth?.[mk] ?? '')}`;

  const { income: incomeBreakdown, expenses: expenseBreakdown } = useMemo(
    () => monthCashflowBreakdownLines(state, mk),
    [state, mk],
  );

  const hint = (
    <>
      Starts with{' '}
      <strong className="text-sage-900 dark:text-moss-tip">logged paychecks</strong> +{' '}
      <strong className="text-sage-900 dark:text-moss-tip">extra cash</strong>, minus{' '}
      <strong className="text-sage-900 dark:text-moss-tip">marked-paid bills</strong> +{' '}
      <strong className="text-sage-900 dark:text-moss-tip">surprises</strong>. Optionally add{' '}
      <strong className="text-sage-900 dark:text-moss-tip">carry-over</strong> when you&apos;re spending money that
      sat around from earlier months — it doesn&apos;t replace logging real paycheques later.
    </>
  );

  const commitSweep = () => {
    const n = Number.parseFloat(draft.trim().replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    onSweepToEmergency(n);
    setDraft('');
  };

  return (
    <HoverTip content={hint}>
      <div>
        <Card
          accent="amber"
          title={panels.budgetSurplus.title}
          subtitle={panels.budgetSurplus.subtitle}
        >
          <div className="mb-4 rounded-xl border border-teal-200/70 bg-teal-50/50 p-4 text-sm dark:border-teal-800/40 dark:bg-teal-950/25">
            <label className="block text-xs font-semibold text-sage-900 dark:text-moss-fg">
              Cushion carried into this month (not paychecks yet)
              <NumericAmountInput
                key={carryInputKey}
                min={0}
                placeholder="0 — typing last month’s leftover helps"
                className="mt-1.5 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.monthSpendableCarryByMonth?.[mk] ?? 0}
                onValueChange={(n) => onSetMonthSpendableCarry(mk, n)}
              />
            </label>
            <p className="mt-2 text-[12px] leading-snug text-sage-700 dark:text-moss-subtle">
              Use when bills are funded from <strong className="text-sage-900 dark:text-moss-fg">money already in checking</strong>{' '}
              left over after last month — the app otherwise only sees paycheck lines you typed.
              {carryStored > 0 && (
                <>
                  {' '}
                  Right now:<strong className="tabular-nums text-sage-900 dark:text-moss-fg"> {formatMoney(carryStored)}</strong>.
                </>
              )}
            </p>
          </div>

          <div className="mb-5 rounded-xl border border-sage-200/80 bg-sage-50/80 p-4 text-sm text-sage-800 dark:border-moss-border dark:bg-moss-surface dark:text-moss-subtle">
            <p className="font-semibold text-sage-900 dark:text-moss-fg">This month ({mk})</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[13px]">
              <li>
                Logged income (pay + extra):{' '}
                <strong className="tabular-nums">{formatMoney(incomeLogged)}</strong>
              </li>
              <li>
                Carry-over (typed above):{' '}
                <strong className="tabular-nums">{formatMoney(carryStored)}</strong>
              </li>
              <li>
                Total counted as spendable this month:{' '}
                <strong className="tabular-nums text-sage-900 dark:text-moss-fg">{formatMoney(incomeTotal)}</strong>
              </li>
              <li>
                Out (actual):{' '}
                <strong className="tabular-nums">{formatMoney(expenseActual)}</strong>
                <span className="text-sage-600 dark:text-moss-muted"> — calendar paid + surprises</span>
              </li>
              <li>
                Net (logged pay only − out):{' '}
                <strong
                  className={`tabular-nums ${netLoggedOnly < 0 ? 'text-red-700 dark:text-red-400' : 'text-sage-800 dark:text-moss-subtle'}`}
                >
                  {formatMoney(netLoggedOnly)}
                </strong>
              </li>
              <li>
                Net incl. carry:{' '}
                <strong
                  className={`tabular-nums ${netWithCarry < 0 ? 'text-red-700 dark:text-red-400' : 'text-sage-900 dark:text-moss-fg'}`}
                >
                  {formatMoney(netWithCarry)}
                </strong>
              </li>
              <li>
                Already swept to emergency: <strong className="tabular-nums">{formatMoney(swept)}</strong>
              </li>
              <li>
                Still available to move:{' '}
                <strong className="tabular-nums text-teal-900 dark:text-moss-tip">{formatMoney(remaining)}</strong>
              </li>
            </ul>
          </div>

          <details className="mb-5 rounded-xl border border-sage-200/80 bg-white/80 p-3 text-[13px] dark:border-moss-border dark:bg-moss-surface/60">
            <summary className="cursor-pointer font-semibold text-sage-900 dark:text-moss-fg">
              Line-by-line breakdown (net incl. carry = {formatMoney(netWithCarry)})
            </summary>
            <div className="mt-3 space-y-4 text-sage-800 dark:text-moss-subtle">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                  Money in
                </p>
                {incomeBreakdown.length === 0 ? (
                  <p className="text-xs italic">
                    Nothing here yet — log pay/extra cash or enter carry-over above for prior cushion.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {incomeBreakdown.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-sage-100/90 pb-1.5 last:border-0 dark:border-moss-border/60"
                      >
                        <span className="min-w-0 break-words">
                          <span className="text-sage-600 dark:text-moss-muted">
                            {row.source === 'carry' ? 'Carry-over' : row.source === 'paycheque' ? 'Pay log' : 'Extra cash'}
                          </span>{' '}
                          · {row.label}{' '}
                          <span className="text-xs text-sage-500 dark:text-moss-muted">
                            ({formatShortDate(parseCashflowDate(row.date))})
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-sage-900 dark:text-moss-fg">
                          +{formatMoney(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-right text-xs font-semibold text-sage-900 dark:text-moss-fg">
                  Subtotal in: {formatMoney(incomeTotal)}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                  Money out
                </p>
                {expenseBreakdown.length === 0 ? (
                  <p className="text-xs italic">No marked-paid calendar lines or surprises dated this month.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {expenseBreakdown.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-sage-100/90 pb-1.5 last:border-0 dark:border-moss-border/60"
                      >
                        <span className="min-w-0 break-words">
                          <span className="text-sage-600 dark:text-moss-muted">
                            {row.source === 'bill_paid' ? 'Bill (marked paid)' : 'Surprise'}
                          </span>{' '}
                          · {row.label}{' '}
                          <span className="text-xs text-sage-500 dark:text-moss-muted">
                            ({formatShortDate(parseCashflowDate(row.date))})
                          </span>
                          {row.source === 'bill_paid' && row.plannedAmount !== undefined && (
                            <span className="block text-[11px] text-sage-500 dark:text-moss-muted">
                              Counted: {formatMoney(row.amount)}
                              {row.usedStoredActual ? ' (your actual paid)' : ` (plan line ${formatMoney(row.plannedAmount)})`}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-sage-900 dark:text-moss-fg">
                          −{formatMoney(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-right text-xs font-semibold text-sage-900 dark:text-moss-fg">
                  Subtotal out: {formatMoney(expenseActual)}
                </p>
              </div>
            </div>
          </details>

          {goalMet ? (
            <p className="mb-4 rounded-xl border border-teal-600/35 bg-teal-50/90 px-4 py-3 text-sm font-medium text-sage-900 dark:border-teal-800/40 dark:bg-teal-950/35 dark:text-moss-subtle">
              <strong className="text-sage-900 dark:text-moss-fg">Emergency target reached</strong> — you can keep
              sweeping slack into this pot, or redirect new extra cash toward other goals under{' '}
              <strong className="text-sage-900 dark:text-moss-fg">Extra cash</strong> and by raising{' '}
              <strong className="text-sage-900 dark:text-moss-fg">savings %</strong> in Household data once you&apos;re
              ready for a wider savings lane.
            </p>
          ) : (
            <p className="mb-4 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
              Sweeps apply when{' '}
              <strong className="text-sage-900 dark:text-moss-fg">net incl. carry</strong> stays positive — adjust
              carry-over honestly so it reflects real cushion, not phantom money.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm font-medium text-sage-800 dark:text-moss-fg">
              Move to emergency fund
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,-]/g, ''))}
                className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              />
            </label>
            <button type="button" className="btn-secondary shrink-0 font-semibold" onClick={() => setDraft(String(remaining.toFixed(2)))} disabled={remaining <= 0}>
              Fill available
            </button>
            <button type="button" className="btn-primary shrink-0 font-semibold" onClick={commitSweep} disabled={remaining <= 0}>
              Apply sweep
            </button>
          </div>

          {sweepsLines.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-sage-200/80 pt-4 text-xs text-sage-700 dark:border-moss-border dark:text-moss-muted">
              {sweepsLines.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 tabular-nums">
                  <span>
                    Swept on {e.date} — to emergency (+{formatMoney(e.amount)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </HoverTip>
  );
}
