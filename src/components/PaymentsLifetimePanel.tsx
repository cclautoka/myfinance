import { memo, useCallback, useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { formatCalendarMonthHeading, HISTORY_TRACKING_STARTED_MONTH_KEY } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { lifetimeLifeSpendRows, type LifeSpendKind } from '../utils/paymentHistory';
import { useInView } from '../hooks/useInView';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BILL_FILL = '#0f766e';
const SURPRISE_FILL = '#d97706';

type ChartRow = {
  name: string;
  total: number;
  kind: LifeSpendKind;
  paidOccurrences: number;
  lastPaidDate: string | null;
  category?: string;
};

function fillForKind(kind: LifeSpendKind): string {
  return kind === 'surprise' ? SURPRISE_FILL : BILL_FILL;
}

function tooltipIndexFromChartState(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null;
  const idx = (state as { activeTooltipIndex?: unknown }).activeTooltipIndex;
  return typeof idx === 'number' && idx >= 0 ? idx : null;
}

function LifetimeSpendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  const kindLabel = p.kind === 'surprise' ? 'Unexpected expense' : 'Total paid';
  const occurrenceLine =
    p.kind === 'bill'
      ? `${p.paidOccurrences}× marked as paid`
      : p.paidOccurrences > 1
        ? `${p.paidOccurrences}× logged`
        : null;

  return (
    <div className="pointer-events-none rounded-xl border border-sage-200/90 bg-white px-3 py-2.5 text-xs shadow-lg dark:border-moss-border dark:bg-moss-elevated">
      <p className="font-semibold text-sage-900 dark:text-moss-fg">{p.name}</p>
      <p className="mt-1 font-display text-sm font-semibold tabular-nums text-teal-800 dark:text-teal-200">
        {formatMoney(p.total)}
      </p>
      <p className="mt-1 text-sage-600 dark:text-moss-subtle">{kindLabel}</p>
      {occurrenceLine ? (
        <p className="mt-0.5 text-sage-500 dark:text-moss-muted">{occurrenceLine}</p>
      ) : null}
      {p.lastPaidDate ? (
        <p className="mt-0.5 text-sage-500 dark:text-moss-muted">Last: {p.lastPaidDate}</p>
      ) : null}
    </div>
  );
}

function LifetimeChart({ chartData, chartHeight, inView }: { chartData: ChartRow[]; chartHeight: number; inView: boolean }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const clearActive = useCallback(() => setActiveIndex(null), []);

  return (
    <div
      className="lifetime-chart w-full min-w-0 select-none"
      style={{ height: chartHeight }}
      onMouseLeave={clearActive}
      onBlur={clearActive}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        className="[&_.recharts-cartesian-axis-tick_text]:fill-sage-600 dark:[&_.recharts-cartesian-axis-tick_text]:fill-moss-muted"
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
          onMouseMove={(state) => setActiveIndex(tooltipIndexFromChartState(state))}
          onMouseLeave={clearActive}
          onClick={(state) => setActiveIndex(tooltipIndexFromChartState(state))}
          style={{ outline: 'none' }}
        >
          <XAxis type="number" tickFormatter={(v) => formatMoney(Number(v))} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11 }} interval={0} />
          <Tooltip
            cursor={false}
            wrapperStyle={{ outline: 'none', zIndex: 20 }}
            content={() =>
              activeIndex != null && chartData[activeIndex] ? (
                <LifetimeSpendTooltip active payload={[{ payload: chartData[activeIndex] }]} />
              ) : null
            }
          />
          <Bar
            dataKey="total"
            radius={[0, 8, 8, 0]}
            className="opacity-90 dark:opacity-85"
            isAnimationActive={inView}
            animationDuration={900}
            animationBegin={0}
            animationEasing="ease-out"
            activeBar={{ fillOpacity: 1, stroke: 'none' }}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={`${entry.name}-${entry.kind}`}
                fill={fillForKind(entry.kind)}
                fillOpacity={activeIndex === i ? 1 : 0.88}
                style={inView ? { animationDelay: `${i * 60}ms` } : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentsLifetimePanelInner({ state }: { state: FinanceState }) {
  const rows = useMemo(() => lifetimeLifeSpendRows(state), [state]);
  const chartData = useMemo<ChartRow[]>(
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

  const { ref: chartAnchorRef, inView } = useInView({
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.2,
    animateOnlyAfterScroll: true,
  });

  const sinceLabel = formatCalendarMonthHeading(HISTORY_TRACKING_STARTED_MONTH_KEY);
  const chartHeight = Math.min(520, Math.max(180, chartData.length * 34 + 80));

  return (
    <Card
      accent="emerald"
      title={panels.billsLifetime.title}
      subtitle={panels.billsLifetime.subtitle(sinceLabel)}
      className="dashboard-below-fold"
    >
      {chartData.length === 0 ? (
        <p className="text-sm font-medium text-sage-600 dark:text-moss-muted">
          {panels.billsLifetime.empty}
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-sage-700 dark:text-moss-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BILL_FILL }} aria-hidden />
              Planned bills
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: SURPRISE_FILL }}
                aria-hidden
              />
              Unexpected Expense
            </span>
          </div>
          <div ref={chartAnchorRef} className="min-h-0 w-full min-w-0">
            {inView ? (
              <LifetimeChart chartData={chartData} chartHeight={chartHeight} inView={inView} />
            ) : (
              <div
                className="w-full animate-pulse rounded-xl bg-sage-200/60 dark:bg-moss-bg/80"
                style={{ height: chartHeight }}
                aria-hidden
              />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export const PaymentsLifetimePanel = memo(PaymentsLifetimePanelInner);
