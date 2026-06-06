import { useMemo, useState, type ReactNode } from 'react';
import { useInView } from '../hooks/useInView';
import type { FinanceState } from '../types/finance';
import {
  dashboardBillsTickedTip,
  dashboardDebtFreeMonthsTip,
  dashboardDebtFreeMonthsTrendTip,
  dashboardDebtTip,
  dashboardEmergencyTip,
  dashboardIncomeLoggedVsPlannedTip,
  dashboardIncomeTip,
  dashboardLeftFromDepositsTip,
  dashboardNextBillTip,
  dashboardPlannedVsActualExpensesTip,
  dashboardSafeSpendTip,
  dashboardSavingsSliderTip,
  ringFirst1kTip,
  ringThreeMonthTip,
} from '../copy/tooltips';
import { allocationBreakdown } from '../utils/allocation';
import { monthActualExpenseTotal, monthSpendableCarryRemainingSoFar, pocketLeftSoFar } from '../utils/budgetSurplus';
import { incomeLogMonthTotal } from '../utils/incomeLog';
import {
  billIsInGraceAfterDue,
  billsPaidThisMonthCount,
  billVisualStatus,
  firstOverdueTimelineBill,
  nextBill,
} from '../utils/billsTimeline';
import {
  combinedMonthlyIncome,
  extraIncomeMonthTotal,
  surpriseExpensesMonthTotal,
  totalDebtRemaining,
} from '../utils/calculations';
import { estimatedDebtFreeMonths, debtFreeMonthsTrend } from '../utils/debtFree';
import { formatMoney, formatTimelineDateLabel } from '../utils/format';
import { computeSafeSpend } from '../utils/safeSpend';
import { dashboard as dashboardCopy } from '../copy/dashboard';
import { payLoggedVersusPlannedLine } from '../copy/payVsPlannedNotes';
import { currentMonthKey } from '../data/defaults';
import { HintWithInfo } from './ui/HintWithInfo';
import { InfoTipButton } from './ui/InfoTipButton';
import { ProgressRing } from './ui/ProgressRing';
import { NumericAmountInput } from './ui/NumericInputs';
import { DebtFreeMonthsTrend } from './DebtFreeMonthsTrend';

/**
 * Card-local type scale (`cqi` = 1% of card inline size). Viewport `vw` was wrong here: the snapshot
 * sits in a narrow center column on large screens, so vw made numbers huge with almost no side padding.
 */
const METRIC_HERO_SIZE =
  'min-w-0 max-w-full font-display font-semibold tabular-nums leading-[1.05] tracking-tight text-[clamp(1.25rem,7cqi+0.75rem,1.875rem)]';

const METRIC_SUBHERO_SIZE =
  'min-w-0 max-w-full font-display font-semibold tabular-nums leading-[1.05] tracking-tight text-[clamp(1.125rem,5.5cqi+0.55rem,1.625rem)]';

type MetricCardVariant = 'income' | 'dues' | 'safety' | 'neutral';

const METRIC_VARIANT_CLASS: Record<MetricCardVariant, string> = {
  income: 'metric-card-tech',
  dues: 'metric-card-dues',
  safety: 'metric-card-safety',
  neutral: 'metric-card-neutral',
};

function MetricCard({
  children,
  className = '',
  preview = false,
  variant = 'income',
}: {
  children: ReactNode;
  className?: string;
  preview?: boolean;
  variant?: MetricCardVariant;
}) {
  return (
    <div
      className={`${METRIC_VARIANT_CLASS[variant]} relative min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-sage-900/12 bg-white/95 shadow-md backdrop-blur-sm transition-all duration-300 hover:border-teal-500/30 hover:shadow-xl dark:border-moss-border dark:bg-moss-elevated/95 dark:hover:border-teal-500/35 ${
        preview ? 'px-4 py-4 pr-11' : 'px-6 py-5 pr-12 sm:px-8 sm:py-6 sm:pr-14'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Info control floats top-right; metric content stays full width. */
function MetricWithTip({ tip, children }: { tip: ReactNode; children: ReactNode; preview?: boolean }) {
  return (
    <div className="app-metric-tile relative min-w-0 w-full">
      <div className="pointer-events-none absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
        <div className="pointer-events-auto">
          <InfoTipButton content={tip} />
        </div>
      </div>
      {children}
    </div>
  );
}

function MetricSubBoxWithTip({
  tip,
  children,
}: {
  tip: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="metric-subbox-tech relative mt-4 w-full rounded-xl border border-sage-200/80 px-4 py-3 pr-12 dark:border-moss-border">
      <div className="absolute right-2 top-2 z-10">
        <InfoTipButton content={tip} />
      </div>
      {children}
    </div>
  );
}

export function DashboardOverview({
  state,
  variant = 'default',
  onEmergencyFund,
  onSavingsGoals,
  onGoToWorkspaceGoals,
}: {
  state: FinanceState;
  variant?: 'default' | 'preview';
  onEmergencyFund?: (next: number) => void;
  onSavingsGoals?: (next: FinanceState['savingsGoals']) => void;
  onGoToWorkspaceGoals?: () => void;
}) {
  const preview = variant === 'preview';
  const { ref: ringsRef, inView: ringsInView } = useInView({
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.15,
    animateOnlyAfterScroll: true,
  });
  const ringsAnimate = preview || ringsInView;
  const [manualGoalAdds, setManualGoalAdds] = useState<Record<string, number>>({});
  const [manualGoalSubs, setManualGoalSubs] = useState<Record<string, number>>({});
  const goalManualDefault = useMemo(() => 200, []);
  const goalSubDefault = useMemo(() => 100, []);
  const income = combinedMonthlyIncome(state);
  const debt = totalDebtRemaining(state.debts, new Date(), state);
  const mk = currentMonthKey();
  const extraIn = extraIncomeMonthTotal(state, mk);
  const surprises = surpriseExpensesMonthTotal(state, mk);
  const loggedPay = incomeLogMonthTotal(state, mk);
  const carriedOver = monthSpendableCarryRemainingSoFar(state, mk);
  const pocketLeft = pocketLeftSoFar(state, mk);
  const nb = nextBill(state);
  const backlogOverdue = firstOverdueTimelineBill(state);
  const nextBillStatus = nb ? billVisualStatus(state, nb) : null;
  const nextBillGrace = nb ? billIsInGraceAfterDue(state, nb) : false;
  const months = estimatedDebtFreeMonths(state);
  const debtFreeTrend = useMemo(() => debtFreeMonthsTrend(state), [state]);
  const safe = computeSafeSpend(state);
  const br = allocationBreakdown(state);
  const { savings } = br;
  const plannedExpenseTotal = br.totalAllocated;
  const actualExpenseMonth = monthActualExpenseTotal(state, mk);
  const monthlyFloor = Math.max(1, br.essentials + br.debt);
  const suggested3month = monthlyFloor * 3;

  const fund1k = Math.min(1, state.emergencyFund / 1000);
  const fund3 = Math.min(1, state.emergencyFund / Math.max(state.threeMonthFundTarget, 1));
  const goalRows = state.savingsGoals ?? [];
  const allocatedTotal = goalRows.reduce((s, g) => s + (Number(g.balance) || 0), 0);
  const allocRoom = Math.max(0, (Number(state.emergencyFund) || 0) - allocatedTotal);

  const extrasLine =
    extraIn === 0 && surprises === 0
      ? ''
      : extraIn > 0 && surprises > 0
        ? `Other income (month): ${formatMoney(extraIn)} · One-off expenses: ${formatMoney(surprises)}`
        : extraIn > 0
          ? `Other income (month): ${formatMoney(extraIn)}`
          : `One-off expenses (month): ${formatMoney(surprises)}`;

  const metricGridClass = 'app-metric-grid grid min-w-0 w-full grid-cols-1 gap-4 sm:gap-5';
  const splitCols = preview ? 'grid-cols-1 gap-4' : 'grid-cols-1 gap-8 sm:grid-cols-2';

  const DEDUCT_BUTTON_CLASS =
    'btn-secondary btn-secondary-sm border border-rose-300/70 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-950/25 dark:text-rose-200 dark:hover:bg-rose-950/40';

  function RingControls({
    id,
    canDeductQuick50,
    onAdd,
    onDeduct,
    addCap,
    currentBalance,
  }: {
    id: string;
    /** Show the quick −$50 button (for goals). */
    canDeductQuick50?: boolean;
    /** Called with the final +delta to apply (already capped). */
    onAdd: (delta: number) => void;
    /** Called with the final −delta to apply (already capped). */
    onDeduct: (delta: number) => void;
    /** Upper bound for how much can be added right now. */
    addCap: number;
    /** Current balance for deduct capping. */
    currentBalance: number;
  }) {
    const addValue = manualGoalAdds[id] ?? goalManualDefault;
    const subValue = manualGoalSubs[id] ?? goalSubDefault;
    const canAdd = addCap > 0;
    const canDeduct = currentBalance > 0;

    return (
      <div className="flex w-full max-w-[22rem] flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[25, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              className="btn-secondary btn-secondary-sm"
              onClick={() => {
                const add = Math.min(n, addCap);
                if (add <= 0) return;
                onAdd(add);
              }}
              disabled={!canAdd}
            >
              +{formatMoney(n)}
            </button>
          ))}
          {canDeductQuick50 ? (
            <button
              type="button"
              className="btn-secondary btn-secondary-sm"
              onClick={() => {
                const sub = Math.min(50, currentBalance);
                if (sub <= 0) return;
                onDeduct(sub);
              }}
              disabled={!canDeduct}
            >
              −{formatMoney(50)}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <NumericAmountInput
              min={0}
              className="w-[7.5rem] rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={addValue}
              onValueChange={(n) => setManualGoalAdds((m) => ({ ...m, [id]: n }))}
            />
            <button
              type="button"
              className="btn-primary btn-primary-sm"
              onClick={() => {
                const raw = Number(addValue);
                if (!Number.isFinite(raw) || raw <= 0) return;
                const add = Math.min(raw, addCap);
                if (add <= 0) return;
                onAdd(add);
              }}
              disabled={!canAdd}
            >
              Add
            </button>
          </div>

          <div className="flex items-center gap-2">
            <NumericAmountInput
              min={0}
              className="w-[7.5rem] rounded-lg border border-sage-300 bg-white px-2 py-1.5 text-sm text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
              value={subValue}
              onValueChange={(n) => setManualGoalSubs((m) => ({ ...m, [id]: n }))}
            />
            <button
              type="button"
              className={DEDUCT_BUTTON_CLASS}
              onClick={() => {
                const raw = Number(subValue);
                if (!Number.isFinite(raw) || raw <= 0) return;
                const sub = Math.min(raw, currentBalance);
                if (sub <= 0) return;
                onDeduct(sub);
              }}
              disabled={!canDeduct}
            >
              Deduct
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      className={`@container/snapshot snapshot-tech-shell dashboard-snapshot-enter overflow-hidden border border-white/14 bg-gradient-to-br from-sage-900 via-sage-800 to-teal-900 text-white shadow-xl dark:border-white/12 dark:from-moss-bg dark:via-moss-surface dark:to-moss-bg dark:shadow-2xl ${
        preview ? 'rounded-xl' : 'rounded-[1.75rem]'
      }`}
    >
      <div className={preview ? 'relative min-w-0 px-4 pb-6 pt-6' : 'relative min-w-0 px-5 pb-10 pt-10 sm:px-12'}>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-teal-200/90 dark:text-teal-300/85">
          Reporting period · {mk}
        </p>
        <h2
          className={
            preview
              ? 'mt-2 text-center font-display text-[1.5rem] font-semibold leading-[1.1] tracking-tight'
              : 'mt-3 text-center font-display text-[2.125rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.5rem]'
          }
        >
          {dashboardCopy.snapshotTitle}
        </h2>
        {preview ? (
          <p className="mx-auto mt-3 max-w-lg line-clamp-2 text-center text-xs leading-relaxed text-sage-100/95">
            {dashboardCopy.snapshotIntroPreview}
          </p>
        ) : (
          <HintWithInfo className="mx-auto mt-4 max-w-lg">{dashboardCopy.snapshotIntro}</HintWithInfo>
        )}

        <div
          className={`app-metric-grid ${metricGridClass} mx-auto max-w-none ${preview ? 'mt-6' : 'mt-10'}`}
        >
          <MetricWithTip tip={dashboardIncomeTip()} preview={preview}>
            <MetricCard className="text-sage-900 dark:text-moss-fg" preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                {dashboardCopy.plannedIncomeLabel}
              </p>
              <p className={`mt-2 text-sage-950 dark:text-moss-fg ${METRIC_HERO_SIZE}`}>{formatMoney(income)}</p>
              <p className="mt-3 text-xs leading-snug text-sage-700 dark:text-moss-subtle">
                {dashboardCopy.plannedIncomeHelper}
              </p>
              <MetricSubBoxWithTip tip={dashboardLeftFromDepositsTip()}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                  {dashboardCopy.leftFromDepositsLabel}
                </p>
                <p
                  className={`mt-1 ${
                    pocketLeft >= 0
                      ? 'text-sage-950 dark:text-moss-fg'
                      : 'text-rose-700 dark:text-rose-300/90'
                  } ${METRIC_SUBHERO_SIZE}`}
                >
                  {formatMoney(pocketLeft)}
                </p>
                <p className="mt-2 text-[11px] leading-snug text-sage-600 dark:text-moss-muted">
                  {dashboardCopy.leftFromDepositsHelper}
                </p>
                {carriedOver > 0 ? (
                  <p className="mt-2 text-[11px] leading-snug text-teal-800 dark:text-teal-200/90">
                    {dashboardCopy.carryOverLine(formatMoney(carriedOver))}
                  </p>
                ) : null}
              </MetricSubBoxWithTip>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardIncomeLoggedVsPlannedTip(income, loggedPay)} preview={preview}>
            <MetricCard className="text-sage-900 dark:text-moss-fg" preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                {dashboardCopy.depositsLabel(mk)}
              </p>
              <p className={`mt-2 text-sage-950 dark:text-moss-fg ${METRIC_HERO_SIZE}`}>{formatMoney(loggedPay)}</p>
              <p className="mt-3 text-xs leading-snug text-sage-700 dark:text-moss-subtle">
                {payLoggedVersusPlannedLine(income, loggedPay)}
              </p>
              {!preview ? (
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('income-log-this-month')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                  className="mt-3 text-left text-xs font-semibold text-sage-800 underline decoration-sage-400 decoration-2 underline-offset-2 hover:text-sage-950 dark:text-moss-tip dark:decoration-moss-muted dark:hover:text-moss-fg"
                >
                  {loggedPay > 0 ? dashboardCopy.showPaychequeRowsCta : dashboardCopy.logPaychequeCta}
                </button>
              ) : null}
            </MetricCard>
          </MetricWithTip>
        </div>

        <div className="mx-auto mt-6 min-w-0 w-full max-w-5xl">
          <MetricWithTip tip={dashboardPlannedVsActualExpensesTip()} preview={preview}>
            <MetricCard className="text-sage-900 dark:text-moss-fg" preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Planned outflows vs counted this month ({mk})
              </p>
              <div className={`mt-4 grid min-w-0 ${splitCols}`}>
                <div
                  className={`min-w-0 dark:border-moss-border ${
                    preview
                      ? 'border-b border-sage-200/90 pb-4'
                      : 'border-b border-sage-200/90 pb-6 sm:border-b-0 sm:border-r sm:border-sage-200/90 sm:pb-0 sm:pr-6'
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                    Planned (Household + Plan dollars)
                  </p>
                  <p className={`mt-2 text-sage-950 dark:text-moss-fg ${METRIC_SUBHERO_SIZE}`}>
                    {formatMoney(plannedExpenseTotal)}
                  </p>
                  <p className="mt-3 text-[12px] leading-snug text-sage-700 dark:text-moss-subtle">
                    Essentials · food · debt payments · planned savings · planned personal — one monthly footprint from your typed
                    plan.
                  </p>
                </div>
                <div className={`min-w-0 ${preview ? 'pt-1' : 'sm:pl-2'}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                    {dashboardCopy.actualExpenseLabel}
                  </p>
                  <p className={`mt-2 text-teal-950 dark:text-moss-tip ${METRIC_SUBHERO_SIZE}`}>
                    {formatMoney(actualExpenseMonth)}
                  </p>
                  <p className="mt-3 text-[12px] leading-snug text-sage-700 dark:text-moss-subtle">
                    {dashboardCopy.actualExpenseHelper()}
                  </p>
                </div>
              </div>
            </MetricCard>
          </MetricWithTip>
        </div>

        {extrasLine !== '' && (
          <p className="mx-auto mt-8 max-w-xl text-center text-sm font-medium text-teal-100">{extrasLine}</p>
        )}

        <div className={`app-metric-grid ${metricGridClass} mx-auto max-w-none text-sage-950 ${preview ? 'mt-6' : 'mt-10'}`}>
          <MetricWithTip tip={dashboardEmergencyTip()} preview={preview}>
            <MetricCard variant="safety">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Emergency fund balance
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums dark:text-moss-fg">{formatMoney(state.emergencyFund)}</p>
              <p className="mt-1 text-[11px] text-sage-600 dark:text-moss-muted">Manually maintained</p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardDebtTip()} preview={preview}>
            <MetricCard variant="neutral">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Total debt balance (approx.)
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums dark:text-moss-fg">{formatMoney(debt)}</p>
              <p className="mt-1 text-[11px] text-sage-600 dark:text-moss-muted">From entered balances; not interest-accrual precise</p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardNextBillTip()} preview={preview}>
            <MetricCard
              variant="dues"
              className={
                backlogOverdue
                  ? 'border-2 border-red-600 shadow-md ring-2 ring-red-500/25 dark:border-red-500'
                  : nextBillStatus === 'soon'
                    ? 'border border-amber-300/90 dark:border-amber-800/45'
                    : ''
              }
            >
              {backlogOverdue && (
                <div className="mb-3 rounded-lg border border-red-200/90 bg-red-50 px-3 py-2 dark:border-red-800/40 dark:bg-red-950/40">
                  <p className="text-center text-[10px] font-bold uppercase tracking-wide text-red-800 dark:text-red-300/95">
                    Overdue backlog
                  </p>
                  <p className="mt-1.5 text-center text-xs font-semibold text-red-950 dark:text-red-100">
                    {backlogOverdue.name} · {formatTimelineDateLabel(backlogOverdue.due)} · {formatMoney(backlogOverdue.amount)}
                  </p>
                  <p className="mt-1 text-center text-[11px] leading-snug text-red-900/90 dark:text-red-200/85">
                    {dashboardCopy.backlogMessage}
                  </p>
                </div>
              )}
              {nextBillStatus === 'soon' && nb && !nextBillGrace && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200/90">
                  Closing in (business days)
                </p>
              )}
              {nextBillStatus === 'soon' && nb && nextBillGrace && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200/90">
                  Past due · still inside your delay
                </p>
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Next scheduled payment
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums dark:text-moss-fg">
                {nb ? formatMoney(nb.amount) : '—'}
              </p>
              <p className="mt-2 text-xs text-sage-700 dark:text-moss-subtle">
                {nb
                  ? `${nb.name} · ${formatTimelineDateLabel(nb.due)}`
                  : backlogOverdue
                    ? 'Nothing due today or later is still unchecked in the window we scan — clear the backlog above first.'
                    : 'Complete bill schedule under household data.'}
              </p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardSafeSpendTip()} preview={preview}>
            <MetricCard variant="neutral">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Est. weekly room left (cash)
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-teal-900 dark:text-moss-tip">
                {formatMoney(safe.weeklyHint)}
              </p>
              <p className="mt-1 text-[11px] text-sage-600 dark:text-moss-muted">
                From Left from deposits · not plan-based
              </p>
            </MetricCard>
          </MetricWithTip>
        </div>

        <div className={`app-metric-grid ${metricGridClass} mx-auto max-w-none text-sage-950 ${preview ? 'mt-6' : 'mt-8'}`}>
          <MetricWithTip tip={dashboardBillsTickedTip()} preview={preview}>
            <MetricCard
              variant="dues"
              className={preview ? 'text-center' : 'text-center sm:text-left'}
              preview={preview}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Payments marked complete (MTD)
              </p>
              <p className="mt-2 font-display text-4xl font-semibold tabular-nums dark:text-moss-fg">
                {billsPaidThisMonthCount(state)}
              </p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardDebtFreeMonthsTip()} preview={preview}>
            <MetricCard
              variant="neutral"
              className={preview ? 'text-center' : 'text-center sm:text-left'}
              preview={preview}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Est. months to debt-free*
              </p>
              <div
                className={`mt-2 flex items-center gap-2.5 ${preview ? 'justify-center' : 'justify-center sm:justify-start'}`}
              >
                <p className="font-display text-4xl font-semibold tabular-nums dark:text-moss-fg">
                  {months === null ? '—' : months === 0 ? '0' : String(months)}
                </p>
                {!preview ? (
                  <DebtFreeMonthsTrend
                    kind={debtFreeTrend.kind}
                    tip={dashboardDebtFreeMonthsTrendTip(
                      debtFreeTrend.kind,
                      debtFreeTrend.delta,
                      debtFreeTrend.priorMonths,
                      debtFreeTrend.currentMonths,
                    )}
                  />
                ) : null}
              </div>
            </MetricCard>
          </MetricWithTip>
          <div className={`min-w-0 w-full ${preview ? '' : 'sm:col-span-2'}`}>
            <MetricWithTip tip={dashboardSavingsSliderTip()} preview={preview}>
              <MetricCard
                variant="neutral"
                className={
                  preview ? 'text-center' : 'text-center sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4 sm:text-left'
                }
                preview={preview}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted sm:col-span-2">
                  Savings · plan vs achieved*
                </p>
                <div className="mt-4 space-y-1 sm:mt-0">
                  <p className="text-[11px] font-semibold text-sage-600 dark:text-moss-muted">Planned lane (intent)</p>
                  <p className="font-display text-3xl font-semibold tabular-nums dark:text-moss-fg sm:text-[2.25rem]">
                    {formatMoney(savings)}
                  </p>
                </div>
                <div className="mt-5 border-t border-sage-200/90 pt-4 dark:border-moss-border sm:mt-0 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                  <p className="text-[11px] font-semibold text-sage-600 dark:text-moss-muted">Achieved (backup balance you type)</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-teal-900 dark:text-moss-tip sm:text-[2.25rem]">
                    {formatMoney(state.emergencyFund)}
                  </p>
                </div>
                <p className="mt-4 text-[11px] leading-snug text-sage-600 dark:text-moss-muted sm:col-span-2 sm:mt-2">
                  {dashboardCopy.savingsRingsNote}
                </p>
              </MetricCard>
            </MetricWithTip>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[11px] leading-relaxed text-teal-200/85 dark:text-moss-muted">
          {dashboardCopy.projectionDisclaimer}
        </p>

        <div
          className={
            preview
              ? 'mt-8 flex flex-wrap items-start justify-center gap-6 border-t border-white/15 pt-8'
              : 'mt-14 flex flex-wrap items-start justify-center gap-14 border-t border-white/15 pt-12'
          }
        >
          <div
            ref={ringsRef}
            id="dashboard-goal-rings"
            className={`scroll-mt-24 transition-all duration-700 ease-out ${
              ringsAnimate ? 'dashboard-rings-enter opacity-100' : 'translate-y-6 opacity-0'
            } ${
              preview
                ? 'mx-auto flex flex-wrap justify-center gap-6 rounded-2xl bg-white/95 px-4 py-6 shadow-lg dark:bg-moss-elevated/95'
                : 'mx-auto flex w-full max-w-none flex-wrap justify-center gap-10 rounded-3xl bg-white/95 px-6 py-10 shadow-lg dark:bg-moss-elevated/95 sm:gap-14 sm:px-10'
            }`}
          >
            <div className="app-ring-tile flex flex-col items-center gap-2">
              <ProgressRing
                value={fund1k}
                delayMs={80}
                playAnimation={ringsAnimate}
                label={fund1k >= 1 ? '$1k reserve milestone met' : '$1k reserve milestone'}
                sublabel={`Balance ${formatMoney(state.emergencyFund)}`}
                tip={ringFirst1kTip()}
              />
              {onEmergencyFund ? (
                <RingControls
                  id="__emergencyFund1k"
                  addCap={Number.POSITIVE_INFINITY}
                  currentBalance={Math.max(0, Number(state.emergencyFund) || 0)}
                  onAdd={(delta) => onEmergencyFund(Math.max(0, (Number(state.emergencyFund) || 0) + delta))}
                  onDeduct={(delta) => onEmergencyFund(Math.max(0, (Number(state.emergencyFund) || 0) - delta))}
                />
              ) : null}
            </div>

            {goalRows.map((g, i) => (
              <div key={g.id} className="app-ring-tile flex flex-col items-center gap-2">
                <ProgressRing
                  value={Math.min(1, g.balance / Math.max(g.targetAmount, 1))}
                  delayMs={160 + i * 120}
                  playAnimation={ringsAnimate}
                  label={g.name}
                  sublabel={`${formatMoney(g.balance)} of ${formatMoney(g.targetAmount)}`}
                  tip={`Savings goal “${g.name}”. Use Dashboard to allocate; manage goals in Workspace.`}
                />
                {onSavingsGoals ? (
                  <RingControls
                    id={g.id}
                    canDeductQuick50
                    addCap={allocRoom}
                    currentBalance={Math.max(0, Number(g.balance) || 0)}
                    onAdd={(delta) => {
                      onSavingsGoals(
                        goalRows.map((x) => (x.id === g.id ? { ...x, balance: (Number(x.balance) || 0) + delta } : x)),
                      );
                    }}
                    onDeduct={(delta) => {
                      onSavingsGoals(
                        goalRows.map((x) =>
                          x.id === g.id ? { ...x, balance: Math.max(0, (Number(x.balance) || 0) - delta) } : x,
                        ),
                      );
                    }}
                  />
                ) : null}
              </div>
            ))}
            {(state.savingsGoals ?? []).length === 0 && state.threeMonthFundTarget > 0 ? (
              <ProgressRing
                value={fund3}
                playAnimation={ringsAnimate}
                label="Extended reserve target"
                sublabel={`Target ${formatMoney(state.threeMonthFundTarget)}`}
                tip={ringThreeMonthTip(state.threeMonthFundTarget, suggested3month)}
              />
            ) : null}
          </div>
          {onGoToWorkspaceGoals ? (
            <button
              type="button"
              className="mx-auto mt-6 text-center text-[11px] font-semibold text-white/85 underline decoration-white/40 underline-offset-2 hover:text-white"
              onClick={onGoToWorkspaceGoals}
            >
              ? Manage goals / withdraw in Workspace (Plan)
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
