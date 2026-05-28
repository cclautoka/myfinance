import type { ReactNode } from 'react';
import type { FinanceState } from '../types/finance';
import {
  dashboardBillsTickedTip,
  dashboardDebtFreeMonthsTip,
  dashboardDebtTip,
  dashboardEmergencyTip,
  dashboardIncomeLoggedVsPlannedTip,
  dashboardIncomeTip,
  dashboardNextBillTip,
  dashboardPlannedVsActualExpensesTip,
  dashboardSafeSpendTip,
  dashboardSavingsSliderTip,
  ringFirst1kTip,
  ringThreeMonthTip,
} from '../copy/tooltips';
import { allocationBreakdown } from '../utils/allocation';
import { monthActualExpenseTotal } from '../utils/budgetSurplus';
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
import { estimatedDebtFreeMonths } from '../utils/debtFree';
import { formatMoney, formatTimelineDateLabel } from '../utils/format';
import { computeSafeSpend } from '../utils/safeSpend';
import { payLoggedVersusPlannedLine } from '../copy/payVsPlannedNotes';
import { currentMonthKey } from '../data/defaults';
import { HoverTip } from './ui/HoverTip';
import { ProgressRing } from './ui/ProgressRing';

/**
 * Card-local type scale (`cqi` = 1% of card inline size). Viewport `vw` was wrong here: the snapshot
 * sits in a narrow center column on large screens, so vw made numbers huge with almost no side padding.
 */
const METRIC_HERO_SIZE =
  'min-w-0 max-w-full font-display font-semibold tabular-nums leading-[1.05] tracking-tight text-[clamp(1.25rem,7cqi+0.75rem,1.875rem)]';

const METRIC_SUBHERO_SIZE =
  'min-w-0 max-w-full font-display font-semibold tabular-nums leading-[1.05] tracking-tight text-[clamp(1.125rem,5.5cqi+0.55rem,1.625rem)]';

function MetricCard({
  children,
  className = '',
  preview = false,
}: {
  children: ReactNode;
  className?: string;
  preview?: boolean;
}) {
  return (
    <div
      className={`min-w-0 w-full max-w-full [container-type:inline-size] rounded-2xl border border-sage-900/12 bg-white shadow-md dark:border-moss-border dark:bg-moss-elevated ${
        preview ? 'px-4 py-4' : 'px-6 py-5 sm:px-8 sm:py-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function MetricWithTip({
  tip,
  children,
  preview = false,
}: {
  tip: ReactNode;
  children: ReactNode;
  preview?: boolean;
}) {
  return (
    <HoverTip content={tip} interaction="auto" layout="corner" className="min-w-0 w-full">
      <MetricCard preview={preview}>{children}</MetricCard>
    </HoverTip>
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
  const income = combinedMonthlyIncome(state);
  const debt = totalDebtRemaining(state.debts);
  const mk = currentMonthKey();
  const extraIn = extraIncomeMonthTotal(state, mk);
  const surprises = surpriseExpensesMonthTotal(state, mk);
  const loggedPay = incomeLogMonthTotal(state, mk);
  const nb = nextBill(state);
  const backlogOverdue = firstOverdueTimelineBill(state);
  const nextBillStatus = nb ? billVisualStatus(state, nb) : null;
  const nextBillGrace = nb ? billIsInGraceAfterDue(state, nb) : false;
  const months = estimatedDebtFreeMonths(state);
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

  const gridCols = preview ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';
  const splitCols = preview ? 'grid-cols-1 gap-4' : 'grid-cols-1 gap-8 sm:grid-cols-2';

  return (
    <section
      className={`overflow-hidden border border-white/14 bg-gradient-to-br from-sage-900 via-sage-800 to-teal-900 text-white shadow-xl dark:border-white/12 dark:from-moss-bg dark:via-moss-surface dark:to-moss-bg dark:shadow-2xl ${
        preview ? 'rounded-xl' : 'rounded-[1.75rem]'
      }`}
    >
      <div className={preview ? 'relative min-w-0 px-4 pb-6 pt-6' : 'relative min-w-0 px-5 pb-10 pt-10 sm:px-10'}>
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
          Financial snapshot
        </h2>
        <p
          className={
            preview
              ? 'mx-auto mt-3 max-w-lg line-clamp-2 text-center text-xs leading-relaxed text-sage-100/95'
              : 'mx-auto mt-4 max-w-lg text-center text-sm leading-relaxed text-sage-100/95'
          }
        >
          {preview ? (
            <>Tap a metric for definitions. Planned vs posted pay for {mk}.</>
          ) : (
            <>
              Hover or Tab a metric for definitions (tap <span className="font-semibold">i</span> on touch). Planned amounts follow{' '}
              <span className="font-medium text-white underline decoration-teal-300/75 underline-offset-2">
                Income & recurring expenses
              </span>
              {' · '}posted pay follows deposits you record this month.
            </>
          )}
        </p>

        <div className={`mx-auto grid min-w-0 w-full max-w-5xl gap-4 ${gridCols} ${preview ? 'mt-6' : 'mt-10'}`}>
          <MetricWithTip tip={dashboardIncomeTip()} preview={preview}>
            <MetricCard className="text-sage-900 dark:text-moss-fg" preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Combined monthly income (planned)
              </p>
              <p className={`mt-2 text-sage-950 dark:text-moss-fg ${METRIC_HERO_SIZE}`}>{formatMoney(income)}</p>
              <p className="mt-3 text-xs leading-snug text-sage-700 dark:text-moss-subtle">
                Husband + wife pay plus any other consistent monthly sources from Your numbers. One-off cash is logged
                separately on the Dashboard.
              </p>
              <div className="mt-4 rounded-xl border border-sage-200/80 bg-sage-50/70 px-4 py-3 dark:border-moss-border dark:bg-moss-bg/40">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                  Pocket left so far (deposits − counted spend)
                </p>
                <p
                  className={`mt-1 ${
                    loggedPay - actualExpenseMonth >= 0
                      ? 'text-sage-950 dark:text-moss-fg'
                      : 'text-rose-700 dark:text-rose-300/90'
                  } ${METRIC_SUBHERO_SIZE}`}
                >
                  {formatMoney(loggedPay - actualExpenseMonth)}
                </p>
              </div>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardIncomeLoggedVsPlannedTip(income, loggedPay)} preview={preview}>
            <MetricCard className="text-sage-900 dark:text-moss-fg" preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Deposits recorded ({mk})
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
                  {loggedPay > 0 ? 'Show paycheque rows for this month' : 'Add pay deposits — opens log below'}
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
                    Actual this month · marked bills + surprises
                  </p>
                  <p className={`mt-2 text-teal-950 dark:text-moss-tip ${METRIC_SUBHERO_SIZE}`}>
                    {formatMoney(actualExpenseMonth)}
                  </p>
                  <p className="mt-3 text-[12px] leading-snug text-sage-700 dark:text-moss-subtle">
                    Bill calendar rows due in {mk} you checked off (with actual-paid when entered), plus one-off shocks logged here for
                    the same month — same bucket as the amber cashflow card.
                  </p>
                </div>
              </div>
            </MetricCard>
          </MetricWithTip>
        </div>

        {extrasLine !== '' && (
          <p className="mx-auto mt-8 max-w-xl text-center text-sm font-medium text-teal-100">{extrasLine}</p>
        )}

        <div className={`mx-auto grid min-w-0 w-full max-w-5xl gap-4 text-sage-950 ${gridCols} ${preview ? 'mt-6' : 'mt-10'}`}>
          <MetricWithTip tip={dashboardEmergencyTip()} preview={preview}>
            <MetricCard>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Emergency fund balance
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums dark:text-moss-fg">{formatMoney(state.emergencyFund)}</p>
              <p className="mt-1 text-[11px] text-sage-600 dark:text-moss-muted">Manually maintained</p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardDebtTip()} preview={preview}>
            <MetricCard>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Total debt balance (approx.)
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums dark:text-moss-fg">{formatMoney(debt)}</p>
              <p className="mt-1 text-[11px] text-sage-600 dark:text-moss-muted">From entered balances; not interest-accrual precise</p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardNextBillTip()} preview={preview}>
            <MetricCard
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
                    Warning · overdue backlog
                  </p>
                  <p className="mt-1.5 text-center text-xs font-semibold text-red-950 dark:text-red-100">
                    {backlogOverdue.name} · {formatTimelineDateLabel(backlogOverdue.due)} · {formatMoney(backlogOverdue.amount)}
                  </p>
                  <p className="mt-1 text-center text-[11px] leading-snug text-red-900/90 dark:text-red-200/85">
                    Still unchecked from an earlier month — open <strong>Bill calendar &amp; checkmarks</strong> and mark handled, or
                    the same line keeps surfacing.
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
            <MetricCard>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Est. weekly discretionary buffer
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-teal-900 dark:text-moss-tip">
                {formatMoney(safe.weeklyHint)}
              </p>
              <p className="mt-1 text-[11px] text-sage-600 dark:text-moss-muted">Illustrative; not spending advice</p>
            </MetricCard>
          </MetricWithTip>
        </div>

        <div className={`mx-auto grid min-w-0 w-full max-w-5xl gap-4 text-sage-950 ${gridCols} ${preview ? 'mt-6' : 'mt-8'}`}>
          <MetricWithTip tip={dashboardBillsTickedTip()} preview={preview}>
            <MetricCard className={preview ? 'text-center' : 'text-center sm:text-left'} preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Payments marked complete (MTD)
              </p>
              <p className="mt-2 font-display text-4xl font-semibold tabular-nums dark:text-moss-fg">
                {billsPaidThisMonthCount(state)}
              </p>
            </MetricCard>
          </MetricWithTip>
          <MetricWithTip tip={dashboardDebtFreeMonthsTip()} preview={preview}>
            <MetricCard className={preview ? 'text-center' : 'text-center sm:text-left'} preview={preview}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
                Est. months to debt-free*
              </p>
              <p className="mt-2 font-display text-4xl font-semibold tabular-nums dark:text-moss-fg">
                {months === null ? '—' : months === 0 ? '0' : String(months)}
              </p>
            </MetricCard>
          </MetricWithTip>
          <div className={`min-w-0 w-full ${preview ? '' : 'sm:col-span-2'}`}>
            <MetricWithTip tip={dashboardSavingsSliderTip()} preview={preview}>
              <MetricCard
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
                  We don’t auto-link pay deposits to savings — bump the rainy‑day figure when money actually lands in that saver.
                </p>
              </MetricCard>
            </MetricWithTip>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[11px] leading-relaxed text-teal-200/85 dark:text-moss-muted">
          *Straight-line projections from current plan inputs and balances; illustrative only—not lender or bank forecasts.
        </p>

        <div
          className={
            preview
              ? 'mt-8 flex flex-wrap items-start justify-center gap-6 border-t border-white/15 pt-8'
              : 'mt-14 flex flex-wrap items-start justify-center gap-14 border-t border-white/15 pt-12'
          }
        >
          <div
            id="dashboard-goal-rings"
            className={`scroll-mt-24 ${
              preview
                ? 'mx-auto flex flex-wrap justify-center gap-6 rounded-2xl bg-white/95 px-4 py-6 shadow-lg dark:bg-moss-elevated/95'
                : 'mx-auto flex flex-wrap justify-center gap-14 rounded-3xl bg-white/95 px-8 py-10 shadow-lg dark:bg-moss-elevated/95'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <ProgressRing
                value={fund1k}
                label={fund1k >= 1 ? '$1k reserve milestone met' : '$1k reserve milestone'}
                sublabel={`Balance ${formatMoney(state.emergencyFund)}`}
                tip={ringFirst1kTip()}
              />
              {onEmergencyFund ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {[25, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="btn-secondary btn-secondary-sm"
                      onClick={() => onEmergencyFund(Math.max(0, (Number(state.emergencyFund) || 0) + n))}
                    >
                      +{formatMoney(n)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {goalRows.map((g) => (
              <div key={g.id} className="flex flex-col items-center gap-2">
                <ProgressRing
                  value={Math.min(1, g.balance / Math.max(g.targetAmount, 1))}
                  label={g.name}
                  sublabel={`${formatMoney(g.balance)} of ${formatMoney(g.targetAmount)}`}
                  tip={`Savings goal “${g.name}”. Use Dashboard to allocate; manage goals in Workspace.`}
                />
                {onSavingsGoals ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {[25, 50, 100].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="btn-secondary btn-secondary-sm"
                        onClick={() => {
                          const add = Math.min(n, allocRoom);
                          if (add <= 0) return;
                          onSavingsGoals(goalRows.map((x) => (x.id === g.id ? { ...x, balance: (Number(x.balance) || 0) + add } : x)));
                        }}
                      >
                        +{formatMoney(n)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary btn-secondary-sm"
                      onClick={() => {
                        const sub = Math.min(50, Number(g.balance) || 0);
                        if (sub <= 0) return;
                        onSavingsGoals(goalRows.map((x) => (x.id === g.id ? { ...x, balance: Math.max(0, (Number(x.balance) || 0) - sub) } : x)));
                      }}
                    >
                      −{formatMoney(50)}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {(state.savingsGoals ?? []).length === 0 && state.threeMonthFundTarget > 0 ? (
              <ProgressRing
                value={fund3}
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
