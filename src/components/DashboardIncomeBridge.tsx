import type { FinanceState } from '../types/finance';
import { currentMonthKey, formatCalendarMonthHeading } from '../data/defaults';
import { dashboardEarnerSplitTip, dashboardVariablePayTip } from '../copy/tooltips';
import { earnerHouseholdPlanSplit } from '../utils/earnerPlanSplit';
import { incomeLogOvertimeByEarner, incomeLogOvertimeMonthTotal } from '../utils/expectedPaycheque';
import { formatMoney, formatPct } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';

function scrollToExtraCash() {
  document.getElementById('finance-life-this-month')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function DashboardIncomeBridge({ state }: { state: FinanceState }) {
  const mk = currentMonthKey();
  const monthLabel = formatCalendarMonthHeading(mk);
  const otBy = incomeLogOvertimeByEarner(state, mk);
  const otTotal = incomeLogOvertimeMonthTotal(state, mk);
  const split = earnerHouseholdPlanSplit(state);
  const hPct = formatPct(split.husbandIncomeShare * 100);
  const wPct = formatPct(split.wifeIncomeShare * 100);

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-6">
      <HoverTip content={dashboardVariablePayTip()}>
        <Card
          accent="emerald"
          title="Variable pay on logged cheques (estimate)"
          subtitle={`${monthLabel} — compares each husband/wife row to usual cheque size from Household (rhythm + optional per-pay amount).`}
        >
          {otTotal <= 0 ? (
            <p className="text-sm text-sage-700 dark:text-moss-subtle">
              Nothing above baseline yet — log pay with the husband or wife lane, or set “usual amount per cheque” so we can spot
              OT-style bumps.
            </p>
          ) : (
            <>
              <p className="font-display text-2xl font-semibold text-sage-900 dark:text-moss-fg">
                {formatMoney(otTotal)} <span className="text-base font-normal text-sage-600 dark:text-moss-muted">this month</span>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-sage-800 dark:text-moss-subtle">
                {otBy.husband > 0 && (
                  <li>
                    Husband lane: <strong className="text-sage-900 dark:text-moss-fg">{formatMoney(otBy.husband)}</strong>
                  </li>
                )}
                {otBy.wife > 0 && (
                  <li>
                    Wife lane: <strong className="text-sage-900 dark:text-moss-fg">{formatMoney(otBy.wife)}</strong>
                  </li>
                )}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-sage-700 dark:text-moss-muted">
                This block is <strong className="text-sage-900 dark:text-moss-fg">information only</strong> — it does not change your
                plan rows or debt math. To <em>track</em> it in your plan, log the same story under{' '}
                <strong className="text-sage-900 dark:text-moss-fg">Extra cash</strong> (bonuses/OT), type a higher{' '}
                <strong className="text-sage-900 dark:text-moss-fg">Emergency fund</strong> after you move money, or pay extra on a card
                and refresh balances in Household.
              </p>
              <button type="button" onClick={scrollToExtraCash} className="btn-secondary btn-secondary-sm mt-3 font-semibold">
                Jump to Extra cash &amp; surprises
              </button>
            </>
          )}
        </Card>
      </HoverTip>

      <HoverTip content={dashboardEarnerSplitTip()}>
        <Card
          accent="violet"
          title="Whose pay covers the plan (proportional view)"
          subtitle="Each salary’s share of the household plan if bills, food, debt, savings, and personal % were funded in line with who earns what — so you can see what’s left on each side before fun-money taps."
        >
          {split.combinedIncome <= 0 ? (
            <p className="text-sm text-sage-700 dark:text-moss-subtle">Add husband and wife monthly pay in Household to see this.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-sage-200 text-xs uppercase text-sage-600 dark:border-moss-border dark:text-moss-muted">
                    <th className="pb-2 pr-4 font-semibold"> </th>
                    <th className="pb-2 pr-4 font-semibold">Husband</th>
                    <th className="pb-2 font-semibold">Wife</th>
                  </tr>
                </thead>
                <tbody className="text-sage-900 dark:text-moss-fg">
                  <tr className="border-b border-sage-100 dark:border-moss-border">
                    <td className="py-2 pr-4 text-sage-600 dark:text-moss-muted">Planned monthly pay</td>
                    <td className="py-2 pr-4 font-semibold tabular-nums">{formatMoney(split.husbandIncome)}</td>
                    <td className="py-2 font-semibold tabular-nums">{formatMoney(split.wifeIncome)}</td>
                  </tr>
                  <tr className="border-b border-sage-100 dark:border-moss-border">
                    <td className="py-2 pr-4 text-sage-600 dark:text-moss-muted">Share of combined pay</td>
                    <td className="py-2 pr-4">{hPct}</td>
                    <td className="py-2">{wPct}</td>
                  </tr>
                  <tr className="border-b border-sage-100 dark:border-moss-border">
                    <td className="py-2 pr-4 text-sage-600 dark:text-moss-muted">
                      Share of household plan
                      <span className="mt-0.5 block text-[11px] font-normal normal-case text-sage-500 dark:text-moss-muted">
                        essentials + groceries + debt + savings + personal (planned dollars)
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-medium tabular-nums">{formatMoney(split.husbandAttributedPlan)}</td>
                    <td className="py-2 font-medium tabular-nums">{formatMoney(split.wifeAttributedPlan)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-sage-700 dark:text-moss-subtle">
                      Left after that share
                      <span className="mt-0.5 block text-[11px] font-normal text-sage-500 dark:text-moss-muted">
                        Two cells add to plan remainder ({formatMoney(split.remainder)})
                      </span>
                    </td>
                    <td
                      className={`py-2 pr-4 font-semibold tabular-nums ${
                        split.husbandLeftInModel < 0 ? 'text-red-700 dark:text-red-400' : 'text-teal-800 dark:text-teal-300/90'
                      }`}
                    >
                      {formatMoney(split.husbandLeftInModel)}
                    </td>
                    <td
                      className={`py-2 font-semibold tabular-nums ${
                        split.wifeLeftInModel < 0 ? 'text-red-700 dark:text-red-400' : 'text-teal-800 dark:text-teal-300/90'
                      }`}
                    >
                      {formatMoney(split.wifeLeftInModel)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-4 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
                Fun-money <strong className="text-sage-800 dark:text-moss-subtle">caps</strong> under Plan split only the{' '}
                <strong className="text-sage-800 dark:text-moss-subtle">Personal</strong> slice — already baked into “household plan”
                above.
              </p>
            </div>
          )}
        </Card>
      </HoverTip>
    </div>
  );
}
