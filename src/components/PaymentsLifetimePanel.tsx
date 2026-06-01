import { memo, useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { formatCalendarMonthHeading, HISTORY_TRACKING_STARTED_MONTH_KEY } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { lifetimeLifeSpendRows, type LifeSpendKind } from '../utils/paymentHistory';
import { useInView } from '../hooks/useInView';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';

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

function LifetimeSpendDetailCard({ row }: { row: ChartRow }) {
  const kindLabel = row.kind === 'surprise' ? 'Unexpected expense' : 'Total paid';
  const occurrenceLine =
    row.kind === 'bill'
      ? `${row.paidOccurrences}× marked as paid`
      : row.paidOccurrences > 1
        ? `${row.paidOccurrences}× logged`
        : null;

  return (
    <div
      className="pointer-events-none z-30 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-sage-200/90 bg-white px-3 py-2.5 text-xs shadow-xl dark:border-moss-border dark:bg-moss-elevated"
      role="tooltip"
    >
      <p className="font-semibold text-sage-900 dark:text-moss-fg">{row.name}</p>
      <p className="mt-1 font-display text-sm font-semibold tabular-nums text-teal-800 dark:text-teal-200">
        {formatMoney(row.total)}
      </p>
      <p className="mt-1 text-sage-600 dark:text-moss-subtle">{kindLabel}</p>
      {occurrenceLine ? (
        <p className="mt-0.5 text-sage-500 dark:text-moss-muted">{occurrenceLine}</p>
      ) : null}
      {row.lastPaidDate ? (
        <p className="mt-0.5 text-sage-500 dark:text-moss-muted">Last: {row.lastPaidDate}</p>
      ) : null}
    </div>
  );
}

function LifetimeSpendBarRow({
  row,
  maxTotal,
  inView,
  isHovered,
  onHover,
  onLeave,
  staggerMs,
}: {
  row: ChartRow;
  maxTotal: number;
  inView: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  staggerMs: number;
}) {
  const widthPct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
  const kindLabel = row.kind === 'surprise' ? 'Unexpected expense' : 'Total paid';

  return (
    <div
      className={`relative grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)_5.5rem] items-center gap-2 sm:grid-cols-[minmax(8rem,10rem)_minmax(0,1fr)_6.25rem] sm:gap-3 ${
        isHovered ? 'rounded-lg ring-2 ring-teal-500/40 dark:ring-teal-400/30' : ''
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      aria-label={`${row.name}: ${formatMoney(row.total)}, ${kindLabel}`}
    >
      {isHovered ? (
        <div className="pointer-events-none absolute bottom-full left-28 right-16 z-30 mb-2 flex justify-center sm:left-32 sm:right-[6.5rem]">
          <LifetimeSpendDetailCard row={row} />
        </div>
      ) : null}

      <span className="truncate text-xs font-semibold text-sage-800 dark:text-moss-subtle" title={row.name}>
        {row.name}
      </span>

      <div className="income-bar-track relative h-8 min-w-0 rounded-lg bg-slate-200/50 dark:bg-moss-bg/80 sm:h-9">
        <div
          className={`income-bar-fill absolute inset-y-1 left-0 rounded-md transition-[filter] duration-200 ${
            isHovered ? 'brightness-110' : ''
          }`}
          style={{
            width: inView ? `${widthPct}%` : '0%',
            backgroundColor: fillForKind(row.kind),
            transitionDelay: inView ? `${staggerMs}ms` : '0ms',
          }}
        />
      </div>

      <span className="text-right text-xs font-semibold tabular-nums text-sage-900 dark:text-moss-fg">
        {formatMoney(row.total)}
      </span>
    </div>
  );
}

function LifetimeSpendBarList({ chartData, inView }: { chartData: ChartRow[]; inView: boolean }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxTotal = useMemo(() => Math.max(...chartData.map((r) => r.total), 1), [chartData]);

  return (
    <div
      className="lifetime-spend-chart w-full min-w-0 space-y-2 sm:space-y-2.5"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {chartData.map((row, i) => (
        <LifetimeSpendBarRow
          key={`${row.name}-${row.kind}`}
          row={row}
          maxTotal={maxTotal}
          inView={inView}
          isHovered={hoveredIndex === i}
          onHover={() => setHoveredIndex(i)}
          onLeave={() => setHoveredIndex((prev) => (prev === i ? null : prev))}
          staggerMs={i * 60}
        />
      ))}
      <div className="flex justify-between pt-1 text-[10px] font-medium tabular-nums text-sage-500 dark:text-moss-muted">
        <span>{formatMoney(0)}</span>
        <span>{formatMoney(maxTotal)}</span>
      </div>
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
  const skeletonHeight = Math.min(520, Math.max(180, chartData.length * 40 + 48));

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
              <LifetimeSpendBarList chartData={chartData} inView={inView} />
            ) : (
              <div
                className="w-full animate-pulse rounded-xl bg-sage-200/60 dark:bg-moss-bg/80"
                style={{ minHeight: skeletonHeight }}
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
