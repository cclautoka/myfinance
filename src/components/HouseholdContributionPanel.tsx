import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { formatMoney } from '../utils/format';
import { panels } from '../copy/panels';
import { monthIncomeSpendSummary, type IncomeSpendRow } from '../utils/householdIncomeSpend';
import { Card } from './ui/Card';

const ROW_STYLES: Record<
  string,
  { income: string; spent: string; overspend: string }
> = {
  owner: {
    income: 'bg-teal-500/35 dark:bg-teal-500/25',
    spent: 'bg-teal-800/75 dark:bg-teal-900/80',
    overspend: 'bg-red-600/85 dark:bg-red-700/90',
  },
  partner: {
    income: 'bg-sky-500/35 dark:bg-sky-500/25',
    spent: 'bg-sky-800/75 dark:bg-sky-900/80',
    overspend: 'bg-red-600/85 dark:bg-red-700/90',
  },
  joint: {
    income: 'bg-violet-500/35 dark:bg-violet-500/25',
    spent: 'bg-violet-800/75 dark:bg-violet-900/80',
    overspend: 'bg-red-600/85 dark:bg-red-700/90',
  },
  extra: {
    income: 'bg-amber-500/35 dark:bg-amber-500/25',
    spent: 'bg-amber-700/75 dark:bg-amber-900/80',
    overspend: 'bg-red-600/85 dark:bg-red-700/90',
  },
};

function rowStyle(key: string) {
  return ROW_STYLES[key] ?? ROW_STYLES.extra;
}

function IncomeSpendBreakdown({ row }: { row: IncomeSpendRow }) {
  return (
    <div className="max-h-[min(70vh,320px)] overflow-y-auto overscroll-contain pr-1 text-xs">
      <p className="font-bold text-slate-900 dark:text-moss-fg">{row.label}</p>
      <p className="mt-1 text-slate-600 dark:text-moss-subtle">
        Logged pay: <strong className="text-slate-900 dark:text-moss-fg">{formatMoney(row.incomeLogged)}</strong>
      </p>
      {row.bills.length > 0 ? (
        <div className="mt-2">
          <p className="font-semibold text-slate-700 dark:text-moss-subtle">Bills marked as paid</p>
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
          <span className="text-red-700 dark:text-red-300">
            {' '}
            ({formatMoney(row.overspend)} {panels.incomeSpend.overLoggedPay})
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-teal-800 dark:text-teal-200">
        Left from pay: <strong>{formatMoney(row.remaining)}</strong>
      </p>
    </div>
  );
}

function IncomeSpendBarRow({
  row,
  onHover,
  onLeave,
  isActive,
}: {
  row: IncomeSpendRow;
  onHover: (row: IncomeSpendRow, el: HTMLElement) => void;
  onLeave: () => void;
  isActive: boolean;
}) {
  const styles = rowStyle(row.key);
  const trackMax = Math.max(row.incomeLogged, row.spent, 1);
  const incomePct = (row.incomeLogged / trackMax) * 100;
  const spentPct = (Math.min(row.spent, row.incomeLogged) / trackMax) * 100;
  const spentWithinIncomePct = row.incomeLogged > 0 ? (Math.min(row.spent, row.incomeLogged) / row.incomeLogged) * 100 : 0;
  const overspendPct = (row.overspend / trackMax) * 100;

  return (
    <div
      className={`grid grid-cols-[4.25rem_minmax(0,1fr)_6.75rem] items-center gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_7.5rem] sm:gap-3 ${
        isActive ? 'rounded-lg ring-2 ring-teal-500/40 dark:ring-teal-400/30' : ''
      }`}
      onMouseEnter={(e) => onHover(row, e.currentTarget)}
      onMouseLeave={onLeave}
      onFocus={(e) => onHover(row, e.currentTarget)}
      onBlur={onLeave}
      tabIndex={0}
      role="group"
      aria-label={`${row.label}: income ${formatMoney(row.incomeLogged)}, spent ${formatMoney(row.spent)}`}
    >
      <span className="text-xs font-semibold text-sage-800 dark:text-moss-subtle">{row.label}</span>

      <div className="relative h-9 min-w-0 overflow-visible rounded-lg bg-slate-200/50 dark:bg-moss-bg/80">
        {/* Full-income band (light) */}
        {row.incomeLogged > 0 ? (
          <div
            className={`absolute inset-y-1 left-0 rounded-md ${styles.income}`}
            style={{ width: `${incomePct}%` }}
          />
        ) : null}
        {/* Spent overlay on top of income portion */}
        {spentWithinIncomePct > 0 && row.incomeLogged > 0 ? (
          <div
            className={`absolute inset-y-1 left-0 rounded-md ${styles.spent}`}
            style={{ width: `${spentPct}%` }}
            title={`Spent ${formatMoney(Math.min(row.spent, row.incomeLogged))}`}
          />
        ) : null}
        {/* Spent with no income — show spent bar only */}
        {row.incomeLogged <= 0 && row.spent > 0 ? (
          <div
            className={`absolute inset-y-1 left-0 rounded-md ${styles.spent}`}
            style={{ width: `${(row.spent / trackMax) * 100}%` }}
          />
        ) : null}
        {/* Overspend beyond income (red) */}
        {row.overspend > 0 ? (
          <div
            className={`absolute inset-y-1 rounded-md ${styles.overspend}`}
            style={{ left: `${incomePct}%`, width: `${overspendPct}%` }}
            title={`${formatMoney(row.overspend)} ${panels.incomeSpend.overLoggedPay}`}
          />
        ) : null}
        {/* Left-from-pay hint inside bar (desktop only, avoids mobile overlap) */}
        {row.remaining > 0 && incomePct > 28 ? (
          <span
            className="pointer-events-none absolute inset-y-0 hidden items-center pl-2 text-[10px] font-semibold text-teal-950/70 dark:text-teal-100/80 sm:flex"
            style={{ left: `${spentPct}%`, maxWidth: `${Math.max(0, incomePct - spentPct)}%` }}
          >
            {formatMoney(row.remaining)} left
          </span>
        ) : null}
      </div>

      <div className="shrink-0 text-right leading-tight tabular-nums">
        <p className="min-w-0 max-w-full font-display font-semibold tabular-nums leading-[1.05] tracking-tight text-[clamp(1.05rem,3.4cqi+0.55rem,1.35rem)] text-sage-950 dark:text-moss-fg">
          {formatMoney(row.incomeLogged)}
        </p>
        <p className="text-[11px] font-semibold text-sage-600 dark:text-moss-muted">logged pay</p>
        {row.remaining > 0 ? (
          <p className="mt-1 text-[12px] font-semibold leading-none text-teal-800 dark:text-teal-300">
            {formatMoney(row.remaining)} <span className="font-semibold">left</span>
          </p>
        ) : null}
        {row.overspend > 0 ? (
          <p className="mt-1 text-[12px] font-semibold leading-none text-red-700 dark:text-red-300">
            +{formatMoney(row.overspend)} <span className="font-semibold">over</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FloatingBreakdown({
  row,
  anchorRect,
  onEnter,
  onLeave,
}: {
  row: IncomeSpendRow;
  anchorRect: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const pad = 8;
  const maxW = 320;
  const left = Math.min(Math.max(pad, anchorRect.left), window.innerWidth - maxW - pad);
  const topBelow = anchorRect.bottom + pad;
  const estHeight = 280;
  const top =
    topBelow + estHeight > window.innerHeight - pad ? Math.max(pad, anchorRect.top - estHeight - pad) : topBelow;

  return createPortal(
    <div
      className="fixed z-[200] w-[min(320px,calc(100vw-1rem))] rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xl dark:border-moss-border dark:bg-moss-elevated"
      style={{ left, top }}
      role="dialog"
      aria-label={`${row.label} breakdown`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <IncomeSpendBreakdown row={row} />
    </div>,
    document.body,
  );
}

export function HouseholdContributionPanel({ state }: { state: FinanceState }) {
  const monthKey = currentMonthKey();
  const summary = useMemo(() => monthIncomeSpendSummary(state, monthKey), [state, monthKey]);
  const panelId = useId();
  const [hovered, setHovered] = useState<{ row: IncomeSpendRow; rect: DOMRect } | null>(null);
  const leaveTimer = useRef<number | null>(null);

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const scheduleLeave = useCallback(() => {
    cancelLeave();
    leaveTimer.current = window.setTimeout(() => setHovered(null), 150);
  }, [cancelLeave]);

  const displayRows = useMemo(
    () => summary.rows.filter((r) => r.key === 'owner' || r.key === 'partner' || r.incomeLogged > 0 || r.spent > 0),
    [summary.rows],
  );

  const anyIncome = summary.rows.some((r) => r.incomeLogged > 0);
  const anyActivity = anyIncome || summary.rows.some((r) => r.spent > 0) || summary.unassigned.billsTotal > 0;

  const onHover = useCallback(
    (row: IncomeSpendRow, el: HTMLElement) => {
      cancelLeave();
      setHovered({ row, rect: el.getBoundingClientRect() });
    },
    [cancelLeave],
  );

  const onLeave = scheduleLeave;

  return (
    <Card
      accent="emerald"
      title={panels.incomeSpend.title}
      subtitle={panels.incomeSpend.subtitle}
      className="!overflow-visible"
    >
      {!anyActivity ? (
        <p className="text-sm font-medium text-sage-600 dark:text-moss-muted">
          {panels.incomeSpend.empty}
        </p>
      ) : (
        <div id={panelId} className="space-y-4 overflow-visible">
          {displayRows.map((row) => (
            <IncomeSpendBarRow
              key={row.key}
              row={row}
              onHover={onHover}
              onLeave={onLeave}
              isActive={hovered?.row.key === row.key}
            />
          ))}

          {hovered ? (
            <FloatingBreakdown
              row={hovered.row}
              anchorRect={hovered.rect}
              onEnter={cancelLeave}
              onLeave={scheduleLeave}
            />
          ) : null}

          {summary.unassigned.billsTotal > 0 ? (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              {panels.incomeSpend.unassigned(
                formatMoney(summary.unassigned.billsTotal),
                summary.unassigned.bills.length,
              )}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
