import { useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { currentMonthKey, previousCalendarMonthKey } from '../data/defaults';
import { debtPayoffPathTip } from '../copy/tooltips';
import { panels } from '../copy/panels';
import {
  debtPayoffScenarioDelta,
  estimatedDebtFreeDate,
  simulateDebtPayoff,
  staleCardBalanceDebts,
} from '../utils/debtFree';
import { totalDebtRemaining } from '../utils/calculations';
import { formatMoney } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';

const SCENARIO_STEPS = [0, 50, 100, 200, 300, 500];

function formatDebtFreeDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function DebtPayoffPathPanel({ state }: { state: FinanceState }) {
  const [extraSpend, setExtraSpend] = useState(0);
  const ref = useMemo(() => new Date(), []);

  const baseline = useMemo(() => simulateDebtPayoff(state.debts, ref), [state.debts, ref]);
  const scenario = useMemo(
    () => simulateDebtPayoff(state.debts, ref, { extraCardSpendPerMonth: extraSpend }),
    [state.debts, ref, extraSpend],
  );
  const delta = useMemo(
    () => debtPayoffScenarioDelta(state.debts, ref, extraSpend),
    [state.debts, ref, extraSpend],
  );

  const mk = currentMonthKey();
  const prevMk = previousCalendarMonthKey(mk);
  const priorSnap = state.debtFreeProjectionByMonth?.[prevMk];
  const staleCards = useMemo(() => staleCardBalanceDebts(state.debts, ref), [state.debts, ref]);

  const chartMonths = baseline.schedule.slice(0, Math.min(36, baseline.schedule.length));
  const maxBal = Math.max(1, ...chartMonths.map((p) => p.totalBalance));

  const monthsDelta =
    priorSnap && priorSnap.months !== null && baseline.months !== null
      ? baseline.months - priorSnap.months
      : null;

  return (
    <HoverTip content={debtPayoffPathTip()}>
      <div id="debt-payoff-path">
        <Card title={panels.debtPayoffPath.title} subtitle={panels.debtPayoffPath.subtitle}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                Debt-free around
              </p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-sage-950 dark:text-moss-fg">
                {baseline.months === null
                  ? '—'
                  : baseline.months === 0
                    ? 'Now'
                    : `${baseline.months} mo · ${formatDebtFreeDate(estimatedDebtFreeDate(state, ref))}`}
              </p>
              {monthsDelta !== null && monthsDelta !== 0 ? (
                <p
                  className={`mt-1 text-xs font-medium ${monthsDelta > 0 ? 'text-rose-700 dark:text-rose-300/90' : 'text-teal-800 dark:text-teal-200/90'}`}
                >
                  vs last month open: {monthsDelta > 0 ? '+' : ''}
                  {monthsDelta} mo
                </p>
              ) : null}
            </div>
            <div className="text-right text-sm text-sage-700 dark:text-moss-subtle">
              <p>Total owed (approx.)</p>
              <p className="font-semibold tabular-nums text-sage-900 dark:text-moss-fg">
                {formatMoney(totalDebtRemaining(state.debts, ref))}
              </p>
            </div>
          </div>

          {staleCards.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-800/45 dark:bg-amber-950/30 dark:text-amber-100/90">
              {staleCards.map((c) => c.name).join(', ')} balance
              {staleCards.length === 1 ? ' has' : ' have'} not been checked recently — update for an honest path.
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
              {panels.debtPayoffPath.chartLabel}
            </p>
            <div className="mt-3 flex h-36 items-end gap-0.5 sm:gap-1">
              {chartMonths.map((p) => (
                <div key={p.monthLabel} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full min-h-[2px] rounded-t bg-sage-600/85 transition-all dark:bg-moss-primary/90"
                    style={{ height: `${Math.max(2, (p.totalBalance / maxBal) * 100)}%` }}
                    title={`${p.monthLabel}: ${formatMoney(p.totalBalance)}`}
                  />
                  {p.monthIndex % 3 === 0 ? (
                    <span className="text-[9px] tabular-nums text-sage-500 dark:text-moss-muted">
                      {p.monthLabel.slice(2)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-sage-200/80 bg-sage-50/60 p-4 dark:border-moss-border dark:bg-moss-surface/50">
            <label className="block text-sm font-semibold text-sage-900 dark:text-moss-fg" htmlFor="extra-card-spend">
              {panels.debtPayoffPath.scenarioLabel}
            </label>
            <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">{panels.debtPayoffPath.scenarioHelp}</p>
            <input
              id="extra-card-spend"
              type="range"
              min={0}
              max={SCENARIO_STEPS.length - 1}
              step={1}
              value={SCENARIO_STEPS.indexOf(extraSpend)}
              onChange={(e) => setExtraSpend(SCENARIO_STEPS[Number(e.target.value)] ?? 0)}
              className="mt-3 w-full accent-sage-700 dark:accent-moss-primary"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-sage-800 dark:text-moss-subtle">
                +{formatMoney(extraSpend)}/mo on cards
              </span>
              {extraSpend > 0 ? (
                <span className="tabular-nums text-rose-800 dark:text-rose-300/90">
                  {delta.monthsAdded !== null && delta.monthsAdded > 0
                    ? `+${delta.monthsAdded} mo vs baseline (${scenario.months ?? '—'} mo total)`
                    : delta.scenarioMonths === null
                      ? 'May not pay off at this spend rate'
                      : 'Same as baseline'}
                </span>
              ) : (
                <span className="text-sage-600 dark:text-moss-muted">Baseline path</span>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
            {panels.debtPayoffPath.footnote}
          </p>
        </Card>
      </div>
    </HoverTip>
  );
}
