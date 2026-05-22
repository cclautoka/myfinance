import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { formatCalendarMonthHeading, HISTORY_TRACKING_STARTED_MONTH_KEY } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { lifetimeLifeSpendRows, type LifeSpendKind } from '../utils/paymentHistory';
import { Card } from './ui/Card';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BILL_FILL = '#0f766e';
const SURPRISE_FILL = '#d97706';

function fillForKind(kind: LifeSpendKind): string {
  return kind === 'surprise' ? SURPRISE_FILL : BILL_FILL;
}

export function PaymentsLifetimePanel({ state }: { state: FinanceState }) {
  const rows = useMemo(() => lifetimeLifeSpendRows(state), [state]);
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name,
        total: r.total,
        kind: r.kind,
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
      title="Life spends (lifetime)"
      subtitle={`Since ${sinceLabel} — planned bills you marked handled plus unexpected expenses you logged.`}
    >
      {chartData.length === 0 ? (
        <p className="text-sm font-medium text-sage-600 dark:text-moss-muted">
          No lifetime spends yet. Mark bills handled on the checklist or log an unexpected expense.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-sage-700 dark:text-moss-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BILL_FILL }} aria-hidden />
              Planned bills
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SURPRISE_FILL }} aria-hidden />
              Unexpected Expense
            </span>
          </div>
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
                    const p = item?.payload as {
                      kind?: LifeSpendKind;
                      paidOccurrences?: number;
                      lastPaidDate?: string | null;
                    };
                    const label = p?.kind === 'surprise' ? 'Unexpected Expense' : 'Total paid';
                    const parts = [formatMoney(Number(value ?? 0)), label];
                    if (p?.kind === 'bill' && p?.paidOccurrences != null) parts.push(`${p.paidOccurrences}× marked`);
                    if (p?.kind === 'surprise' && p?.paidOccurrences != null && p.paidOccurrences > 1) {
                      parts.push(`${p.paidOccurrences}× logged`);
                    }
                    if (p?.lastPaidDate) parts.push(`Date: ${p.lastPaidDate}`);
                    return [parts.join(' · '), ''];
                  }}
                  labelFormatter={() => ''}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="total" radius={[0, 8, 8, 0]} className="opacity-90 dark:opacity-85">
                  {chartData.map((entry) => (
                    <Cell key={`${entry.name}-${entry.kind}`} fill={fillForKind(entry.kind)} />
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
