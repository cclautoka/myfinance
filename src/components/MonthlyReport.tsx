import { useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { monthlyReportTip } from '../copy/tooltips';
import { formatCalendarMonthHeading, parseCalendarMonthKey } from '../data/defaults';
import { allocationBreakdown } from '../utils/allocation';
import { billsPaidThisMonthCount } from '../utils/billsTimeline';
import {
  combinedMonthlyIncome,
  extraIncomeMonthTotal,
  monthlyEssentialAmount,
  surpriseExpensesMonthTotal,
  totalDebtRemaining,
} from '../utils/calculations';
import { incomeLogOvertimeMonthTotal } from '../utils/expectedPaycheque';
import { incomeLogMonthTotal } from '../utils/incomeLog';
import { exportFinanceCsv } from '../utils/csvExport';
import { totalSurplusSweptForMonth } from '../utils/budgetSurplus';
import { estimatedDebtFreeMonths } from '../utils/debtFree';
import { formatMoney } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';

export function MonthlyReport({
  state,
  summaryMonthKey,
}: {
  state: FinanceState;
  summaryMonthKey: string;
}) {
  const [open, setOpen] = useState(false);

  const refForCounts = useMemo(() => {
    const p = parseCalendarMonthKey(summaryMonthKey);
    if (!p) return new Date();
    return new Date(p.year, p.monthIndex, 15);
  }, [summaryMonthKey]);

  const summary = useMemo(() => {
    const income = combinedMonthlyIncome(state);
    const incomeLogged = incomeLogMonthTotal(state, summaryMonthKey);
    const paychequeOtEst = incomeLogOvertimeMonthTotal(state, summaryMonthKey);
    const br = allocationBreakdown(state);
    const debt = totalDebtRemaining(state.debts);
    const extras = extraIncomeMonthTotal(state, summaryMonthKey);
    const surprises = surpriseExpensesMonthTotal(state, summaryMonthKey);
    const months = estimatedDebtFreeMonths(state);
    const essentials = monthlyEssentialAmount(state.essentials);
    const billsMarked = billsPaidThisMonthCount(state, refForCounts);
    const projected6 =
      state.emergencyFund + br.savings * 6 + extras * 0.2 * 6;
    const surplusSweepsTotal = totalSurplusSweptForMonth(state, summaryMonthKey);
    const surplusSweepsLines = (state.budgetSurplusSweeps ?? []).filter((s) => s.monthKey === summaryMonthKey);
    return {
      income,
      incomeLogged,
      paychequeOtEst,
      br,
      debt,
      extras,
      surprises,
      months,
      essentials,
      billsMarked,
      projected6,
      surplusSweepsTotal,
      surplusSweepsLines,
    };
  }, [state, summaryMonthKey, refForCounts]);

  const downloadCsv = () => {
    const blob = new Blob([exportFinanceCsv(state, summaryMonthKey)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `our-finance-${summaryMonthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <HoverTip content={monthlyReportTip()}>
        <div>
          <Card
            title={`${formatCalendarMonthHeading(summaryMonthKey)} spreadsheet`}
            subtitle="Open a simple list or download CSV for the exact month you chose above — not today’s live dashboard."
          >
            <button type="button" className="btn-primary px-5 py-2" onClick={() => setOpen(true)}>
              Open {summaryMonthKey} report
            </button>
            <button type="button" onClick={downloadCsv} className="btn-secondary ml-3">
              Download CSV
            </button>
          </Card>
        </div>
      </HoverTip>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-sage-200/80 bg-white p-6 shadow-2xl dark:border-moss-border dark:bg-moss-elevated"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-sage-900 dark:text-moss-fg">
                {formatCalendarMonthHeading(summaryMonthKey)} — month summary
              </h2>
              <button type="button" className="btn-ghost px-2 py-1 text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-sage-700 dark:text-moss-subtle">
              <li>Planned monthly income (Household): {formatMoney(summary.income)}</li>
              <li>Pay logged (Paycheque log, dated in this month): {formatMoney(summary.incomeLogged)}</li>
              {summary.paychequeOtEst > 0 && (
                <li>~OT on logged pay vs usual cheque (estimate): {formatMoney(summary.paychequeOtEst)}</li>
              )}
              <li>Essentials (monthlyized): {formatMoney(summary.essentials)}</li>
              <li>Planned savings this month: {formatMoney(summary.br.savings)}</li>
              <li>Extra income logged (dated this month): {formatMoney(summary.extras)}</li>
              <li>Surprise one-off costs (dated this month): {formatMoney(summary.surprises)}</li>
              <li>
                Unused plan → emergency &quot;sweeps&quot; (bookkeeping moves for this calendar month):{' '}
                {formatMoney(summary.surplusSweepsTotal)}
              </li>
              {summary.surplusSweepsLines.length > 0 && (
                <li className="pl-4 text-xs text-sage-600 dark:text-moss-muted">
                  Detail:{' '}
                  {summary.surplusSweepsLines.map((s) => `${s.date} +${formatMoney(s.amount)}`).join(' · ')}
                </li>
              )}
              <li>Bill lines marked handled (due this month): {summary.billsMarked}</li>
              <li>Debt remaining (estimate): {formatMoney(summary.debt)}</li>
              <li>
                Soft months‑to‑debt‑free (linear):{' '}
                {summary.months === null ? '—' : summary.months}
              </li>
              <li>
                Six‑month savings sketch (typed emergency fund today + planned savings + 20% of this month extras, rough):{' '}
                {formatMoney(summary.projected6)}
              </li>
            </ul>
            <p className="mt-4 text-xs text-sage-600 dark:text-moss-muted">
              Kitchen‑table forecast from stored numbers — fix past deposits or plan inputs and reopen to see totals change.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
