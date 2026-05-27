import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { currentMonthKey, formatCalendarMonthHeading } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { monthIncomeSpendSummary, type IncomeSpendRow } from '../utils/householdIncomeSpend';
import { Card } from './ui/Card';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const PRIMARY_SPENT = '#0f766e';
const PRIMARY_LEFT = '#99f6e4';
const PARTNER_SPENT = '#0369a1';
const PARTNER_LEFT = '#7dd3fc';
const JOINT_SPENT = '#6d28d9';
const JOINT_LEFT = '#ddd6fe';
const EXTRA_SPENT = '#b45309';
const EXTRA_LEFT = '#fde68a';

function fillsForKey(key: string): { spent: string; remaining: string } {
  if (key === 'owner') return { spent: PRIMARY_SPENT, remaining: PRIMARY_LEFT };
  if (key === 'partner') return { spent: PARTNER_SPENT, remaining: PARTNER_LEFT };
  if (key === 'joint') return { spent: JOINT_SPENT, remaining: JOINT_LEFT };
  return { spent: EXTRA_SPENT, remaining: EXTRA_LEFT };
}

type ChartRow = IncomeSpendRow & {
  name: string;
  spentStack: number;
  remainingStack: number;
};

function IncomeSpendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="max-w-xs rounded-xl border border-slate-200/90 bg-white p-3 text-xs shadow-lg dark:border-moss-border dark:bg-moss-elevated">
      <p className="font-bold text-slate-900 dark:text-moss-fg">{row.label}</p>
      <p className="mt-1 text-slate-600 dark:text-moss-subtle">
        Logged pay: <strong className="text-slate-900 dark:text-moss-fg">{formatMoney(row.incomeLogged)}</strong>
      </p>
      {row.bills.length > 0 ? (
        <div className="mt-2">
          <p className="font-semibold text-slate-700 dark:text-moss-subtle">Bills marked</p>
          <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-moss-muted">
            {row.bills.map((b) => (
              <li key={`${b.label}-${b.amount}`}>
                {b.label}: {formatMoney(b.amount)}
              </li>
            ))}
          </ul>
          <p className="mt-1 font-medium">Subtotal {formatMoney(row.billsTotal)}</p>
        </div>
      ) : null}
      {row.surprises.length > 0 ? (
        <div className="mt-2">
          <p className="font-semibold text-slate-700 dark:text-moss-subtle">Unexpected costs</p>
          <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-moss-muted">
            {row.surprises.map((s) => (
              <li key={`${s.label}-${s.amount}`}>
                {s.label}: {formatMoney(s.amount)}
              </li>
            ))}
          </ul>
          <p className="mt-1 font-medium">Subtotal {formatMoney(row.surprisesTotal)}</p>
        </div>
      ) : null}
      <p className="mt-2 border-t border-slate-200/80 pt-2 dark:border-moss-border">
        Spent: <strong>{formatMoney(row.spent)}</strong>
        {row.overspend > 0 ? (
          <span className="text-amber-800 dark:text-amber-200"> ({formatMoney(row.overspend)} over logged pay)</span>
        ) : null}
      </p>
      <p className="mt-1 text-teal-800 dark:text-teal-200">
        Left from pay: <strong>{formatMoney(row.remaining)}</strong>
      </p>
    </div>
  );
}

export function HouseholdContributionPanel({ state }: { state: FinanceState }) {
  const monthKey = currentMonthKey();
  const summary = useMemo(() => monthIncomeSpendSummary(state, monthKey), [state, monthKey]);

  const chartData = useMemo<ChartRow[]>(
    () =>
      summary.rows.map((row) => ({
        ...row,
        name: row.label,
        spentStack:
          row.incomeLogged > 0 ? Math.min(row.spent, row.incomeLogged) : row.spent > 0 ? row.spent : 0,
        remainingStack: row.incomeLogged > 0 ? row.remaining : 0,
      })),
    [summary.rows],
  );

  const monthLabel = formatCalendarMonthHeading(monthKey);
  const anyIncome = summary.rows.some((r) => r.incomeLogged > 0);
  const anyActivity = anyIncome || summary.rows.some((r) => r.spent > 0) || summary.unassigned.billsTotal > 0;

  return (
    <Card
      accent="emerald"
      title="Income vs spend this month"
      subtitle={`${monthLabel} — logged pay is the full bar; darker portion is bills you marked plus your unexpected costs.`}
    >
      {!anyActivity ? (
        <p className="text-sm font-medium text-sage-600 dark:text-moss-muted">
          Log pay in the Paycheque log, then mark bills or add surprise costs to see Primary vs Partner bars.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-sage-700 dark:text-moss-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm" style={{ background: PRIMARY_SPENT }} aria-hidden />
              Spent (Primary)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm border border-teal-900/20" style={{ background: PRIMARY_LEFT }} aria-hidden />
              Left (Primary)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm" style={{ background: PARTNER_SPENT }} aria-hidden />
              Spent (Partner)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm border border-sky-900/20" style={{ background: PARTNER_LEFT }} aria-hidden />
              Left (Partner)
            </span>
          </div>
          <div className="w-full min-w-0" style={{ height: Math.max(160, chartData.length * 56 + 48) }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              className="[&_.recharts-cartesian-axis-tick_text]:fill-sage-600 dark:[&_.recharts-cartesian-axis-tick_text]:fill-moss-muted"
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  domain={[0, summary.chartMax]}
                  tickFormatter={(v) => formatMoney(Number(v))}
                />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip content={<IncomeSpendTooltip />} cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }} />
                <Bar dataKey="spentStack" stackId="pay" radius={[0, 0, 0, 0]}>
                  {chartData.map((row) => (
                    <Cell key={`${row.key}-spent`} fill={fillsForKey(row.key).spent} />
                  ))}
                </Bar>
                <Bar dataKey="remainingStack" stackId="pay" radius={[0, 6, 6, 0]}>
                  {chartData.map((row) => (
                    <Cell key={`${row.key}-left`} fill={fillsForKey(row.key).remaining} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {summary.unassigned.billsTotal > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <strong>{formatMoney(summary.unassigned.billsTotal)}</strong> in marked bills are not tied to Primary or
              Partner yet ({summary.unassigned.bills.length} item
              {summary.unassigned.bills.length === 1 ? '' : 's'}). Re-mark them while signed in, or run the household
              attribution backfill.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
