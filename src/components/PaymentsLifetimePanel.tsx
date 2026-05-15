import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { formatCalendarMonthHeading, HISTORY_TRACKING_STARTED_MONTH_KEY } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { lifetimePaidByBill } from '../utils/paymentHistory';
import { Card } from './ui/Card';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function PaymentsLifetimePanel({ state }: { state: FinanceState }) {
  const rows = useMemo(() => lifetimePaidByBill(state), [state]);
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name,
        total: r.total,
        paidOccurrences: r.paidOccurrences,
        lastPaidDate: r.lastPaidDate,
        category: r.category,
      })),
    [rows],
  );

  const sinceLabel = formatCalendarMonthHeading(HISTORY_TRACKING_STARTED_MONTH_KEY);
  const chartHeight = Math.min(520, Math.max(180, chartData.length * 34 + 80));

  return (
    <Card
      accent="emerald"
      title="Paid on the calendar (lifetime)"
      subtitle={`Since ${sinceLabel} — totals from lines you marked handled, same as cashflow.`}
    >
      {chartData.length === 0 ? (
        <p className="text-sm font-medium text-sage-600 dark:text-moss-muted">
          Nothing marked paid yet in a tracked month. Use the bill checklist when money leaves the account.
        </p>
      ) : (
        <div className="w-full min-w-0" style={{ height: chartHeight }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            className="[&_.recharts-cartesian-axis-tick_text]:fill-sage-600 dark:[&_.recharts-cartesian-axis-tick_text]:fill-moss-muted"
          >
            <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
              <XAxis type="number" tickFormatter={(v) => formatMoney(Number(v))} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const p = item?.payload as { paidOccurrences?: number; lastPaidDate?: string | null };
                  const parts = [formatMoney(Number(value ?? 0)), 'Total paid'];
                  if (p?.paidOccurrences != null) parts.push(`${p.paidOccurrences}× marked`);
                  if (p?.lastPaidDate) parts.push(`Last: ${p.lastPaidDate}`);
                  return [parts.join(' · '), ''];
                }}
                labelFormatter={() => ''}
                contentStyle={{ borderRadius: 12 }}
              />
              <Bar dataKey="total" fill="#0f766e" radius={[0, 8, 8, 0]} className="opacity-90 dark:opacity-85" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
