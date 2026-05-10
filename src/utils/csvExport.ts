import type { FinanceState } from '../types/finance';
import { allocationBreakdown } from './allocation';
import {
  combinedMonthlyIncome,
  effectiveDebtBalance,
  extraIncomeMonthTotal,
  monthlyEssentialAmount,
  surpriseExpensesMonthTotal,
  totalDebtRemaining,
} from './calculations';
import { currentMonthKey } from '../data/defaults';
import { incomeLogOvertimeMonthTotal } from './expectedPaycheque';
import { incomeLogMonthTotal } from './incomeLog';
import { monthSpendableCarry, totalSurplusSweptForMonth } from './budgetSurplus';

const escape = (s: string): string => `"${s.replace(/"/g, '""')}"`;

export const exportFinanceCsv = (state: FinanceState, snapshotMonth?: string): string => {
  const rows: string[][] = [];
  const mk = snapshotMonth ?? currentMonthKey();
  rows.push(['Section', 'Field', 'Value']);
  rows.push(['Income', 'Husband (monthly)', String(state.income.husbandMonthly)]);
  rows.push(['Income', 'Wife (monthly)', String(state.income.wifeMonthly)]);
  rows.push(['Income', 'Husband auto pay log enabled', String(Boolean(state.income.husbandPayAutoLog))]);
  rows.push(['Income', 'Husband pay anchor (YYYY-MM-DD)', state.income.husbandPayAnchor ?? '']);
  rows.push(['Income', 'Wife auto pay log enabled', String(Boolean(state.income.wifePayAutoLog))]);
  rows.push([
    'Income',
    'Wife biweekly pay anchor (YYYY-MM-DD)',
    state.income.wifeBiweeklyPayAnchor ?? '',
  ]);
  const plannedIncome = combinedMonthlyIncome(state);
  rows.push(['Summary', 'Combined income (planned monthly)', String(plannedIncome)]);
  rows.push(['Summary', 'Pay logged this month (deposits)', String(incomeLogMonthTotal(state, mk))]);
  rows.push([
    'Summary',
    'Est. OT on paycheques vs usual cheque (model)',
    String(incomeLogOvertimeMonthTotal(state, mk)),
  ]);
  rows.push(['Summary', 'Debt remaining (est.)', String(totalDebtRemaining(state.debts))]);
  rows.push(['Summary', 'Emergency fund', String(state.emergencyFund)]);
  rows.push(['Essentials', 'Monthly total', String(monthlyEssentialAmount(state.essentials))]);

  const br = allocationBreakdown(state);
  rows.push(['Allocation', 'Essentials $', String(Math.round(br.essentials))]);
  rows.push(['Allocation', 'Groceries $', String(Math.round(br.groceries))]);
  rows.push(['Allocation', 'Debt $', String(Math.round(br.debt))]);
  rows.push(['Allocation', 'Savings $', String(Math.round(br.savings))]);
  rows.push(['Allocation', 'Personal $', String(Math.round(br.personal))]);

  const debtRef = new Date();
  for (const d of state.debts) {
    const eff = Math.round(effectiveDebtBalance(d, debtRef) * 100) / 100;
    const apr = d.annualInterestApr ?? 0;
    rows.push([
      'Debt',
      `${d.name} [${d.kind}]`,
      `bal_stated=${d.balance} bal_effective=${eff} pay=${d.monthlyPayment} apr=${apr}`,
    ]);
  }

  for (const e of state.incomeLog) {
    rows.push([
      'Income log',
      `${e.label} (${e.date}, ${e.earner})`,
      String(e.amount),
    ]);
  }

  rows.push(['This month', 'Extra income total', String(Math.round(extraIncomeMonthTotal(state, mk)))]);
  rows.push([
    'This month',
    'Spendable carry-in typed (prior cushion)',
    String(Math.round(monthSpendableCarry(state, mk))),
  ]);
  rows.push([
    'This month',
    'Surprise expenses total',
    String(Math.round(surpriseExpensesMonthTotal(state, mk))),
  ]);
  rows.push([
    'Unused plan sweep',
    'Total moved to typed emergency balance (manual bookkeeping)',
    String(Math.round(totalSurplusSweptForMonth(state, mk))),
  ]);

  const sweeps = (state.budgetSurplusSweeps ?? []).filter((s) => s.monthKey === mk);
  for (const s of sweeps) {
    rows.push(['Sweep to emergency', `Applied ${s.date} (month ${mk})`, String(Math.round(s.amount))]);
  }

  for (const e of state.surpriseExpenses) {
    rows.push(['Surprise', `${e.label} (${e.date}, ${e.category})`, String(e.amount)]);
  }

  rows.push(['Meta', 'Export month', mk]);

  return rows.map((r) => r.map((c) => escape(String(c))).join(',')).join('\n');
};
