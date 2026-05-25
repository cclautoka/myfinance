import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { currentMonthKey, formatCalendarMonthHeading } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { monthBillContributionStats } from '../utils/householdContribution';
import { Card } from './ui/Card';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const PRIMARY_FILL = '#0f766e';
const PARTNER_FILL = '#0369a1';
const UNKNOWN_FILL = '#64748b';

function fillForKey(key: string): string {
  if (key === 'owner') return PRIMARY_FILL;
  if (key === 'partner') return PARTNER_FILL;
  return UNKNOWN_FILL;
}

export function HouseholdContributionPanel({ state }: { state: FinanceState }) {
  const monthKey = currentMonthKey();
  const stats = useMemo(() => monthBillContributionStats(state, monthKey), [state, monthKey]);
  const chartData = useMemo(
    () =>
      stats.map((s) => ({
        name: s.label,
        dollars: s.dollars,
        count: s.count,
        key: s.key,
      })),
    [stats],
  );

  const monthLabel = formatCalendarMonthHeading(monthKey);
  const totalDollars = stats.reduce((n, s) => n + s.dollars, 0);
  const totalCount = stats.reduce((n, s) => n + s.count, 0);

  return (
    <Card
      accent="emerald"
      title="Who marked bills this month"
      subtitle={`${monthLabel} — checklist items marked handled, by Primary vs Partner.`}
    >
      {totalCount === 0 ? (
        <p className="text-sm font-medium text-sage-600 dark:text-moss-muted">
          Mark bills handled on the checklist to see who contributed this month.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm font-medium text-sage-700 dark:text-moss-subtle">
            {totalCount} bill{totalCount === 1 ? '' : 's'} marked · {formatMoney(totalDollars)} total actual paid
          </p>
          <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-sage-700 dark:text-moss-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRIMARY_FILL }} aria-hidden />
              Primary
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PARTNER_FILL }} aria-hidden />
              Partner
            </span>
          </div>
          <div className="w-full min-w-0" style={{ height: Math.max(140, chartData.length * 48 + 40) }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              className="[&_.recharts-cartesian-axis-tick_text]:fill-sage-600 dark:[&_.recharts-cartesian-axis-tick_text]:fill-moss-muted"
            >
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <XAxis type="number" tickFormatter={(v) => formatMoney(Number(v))} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const count = (item?.payload as { count?: number })?.count ?? 0;
                    return [`${formatMoney(Number(value ?? 0))} (${count} bill${count === 1 ? '' : 's'})`, 'Paid'];
                  }}
                  labelFormatter={() => ''}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="dollars" radius={[0, 6, 6, 0]}>
                  {chartData.map((row) => (
                    <Cell key={row.key} fill={fillForKey(row.key)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
