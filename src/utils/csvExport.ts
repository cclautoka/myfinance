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

function monthKeyFromIsoDate(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function keyMatchesMonth(key: string, monthKey: string): boolean {
  // billPaymentKey can be YYYY-MM (monthly) or YYYY-MM-DD (weekly essentials).
  return key === monthKey || key.startsWith(`${monthKey}-`);
}

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

  for (const e of state.incomeLog.filter((x) => monthKeyFromIsoDate(x.date) === mk)) {
    rows.push([
      'Income log',
      `${e.label} (${e.date}, ${e.earner})`,
      String(e.amount),
    ]);
  }

  rows.push(['This month', 'Extra income total', String(Math.round(extraIncomeMonthTotal(state, mk)))]);
  rows.push([
    'This month',
    'Carry-over typed (prior cushion)',
    String(Math.round(monthSpendableCarry(state, mk))),
  ]);
  rows.push([
    'This month',
    'Surprise expenses total',
    String(Math.round(surpriseExpensesMonthTotal(state, mk))),
  ]);
  rows.push(['This month', 'Planned savings (monthly, plan lane)', String(Math.round(state.plannedSavingsMonthly ?? 0))]);
  rows.push([
    'This month',
    'Planned personal (monthly, plan lane)',
    String(Math.round(state.plannedPersonalMonthly ?? 0)),
  ]);
  rows.push([
    'Unused plan sweep',
    'Total moved to typed emergency balance (workbook only)',
    String(Math.round(totalSurplusSweptForMonth(state, mk))),
  ]);

  const sweeps = (state.budgetSurplusSweeps ?? []).filter((s) => s.monthKey === mk);
  for (const s of sweeps) {
    rows.push([
      'Sweep to emergency',
      `Applied ${s.date} (month ${mk})`,
      `amount=${Math.round(s.amount)} paidByRole=${(s as any).paidByRole ?? ''}`,
    ]);
  }

  for (const e of state.surpriseExpenses.filter((x) => monthKeyFromIsoDate(x.date) === mk)) {
    rows.push(['Surprise', `${e.label} (${e.date}, ${e.category})`, String(e.amount)]);
  }

  for (const e of state.extraIncome.filter((x) => monthKeyFromIsoDate(x.date) === mk)) {
    rows.push(['Extra income', `${e.label} (${e.date}, ${e.category})`, String(e.amount)]);
  }

  // Savings goals + wallets aren't month-scoped in state; include current definitions for completeness.
  for (const g of state.savingsGoals ?? []) {
    rows.push(['Savings goal', `${g.name} (id=${g.id})`, `target=${g.targetAmount} balance=${g.balance}`]);
  }
  rows.push([
    'Wallets',
    'Husband budget/spent',
    `budget=${state.wallets.husbandBudget} spent=${state.wallets.husbandSpent}`,
  ]);
  rows.push(['Wallets', 'Wife budget/spent', `budget=${state.wallets.wifeBudget} spent=${state.wallets.wifeSpent}`]);

  // Bills paid & amounts/attribution for the snapshot month.
  for (const [billId, keys] of Object.entries(state.billsPaid ?? {})) {
    const matched = (keys ?? []).filter((k) => keyMatchesMonth(k, mk));
    for (const k of matched) rows.push(['Bills', `Marked as paid billId=${billId}`, k]);
  }
  for (const [billId, byKey] of Object.entries(state.billPaidAmounts ?? {})) {
    for (const [k, amt] of Object.entries(byKey ?? {})) {
      if (!keyMatchesMonth(k, mk)) continue;
      rows.push(['Bills', `Actual paid billId=${billId} key=${k}`, String(amt)]);
    }
  }
  for (const [billId, byKey] of Object.entries(state.billPaymentAttribution ?? {})) {
    for (const [k, at] of Object.entries(byKey ?? {})) {
      if (!keyMatchesMonth(k, mk)) continue;
      rows.push([
        'Bills',
        `Attribution billId=${billId} key=${k}`,
        `by=${(at as any)?.paidByRole ?? ''} at=${(at as any)?.atIso ?? ''}`,
      ]);
    }
  }

  const opening = state.monthCashflowOpening?.[mk];
  if (opening) {
    rows.push(['Month opening', 'confirmedAt', opening.confirmedAt]);
    rows.push(['Month opening', 'settledFromPriorMonthKey', opening.settledFromPriorMonthKey]);
    rows.push(['Month opening', 'priorSurplusRemainderShown', String(opening.priorSurplusRemainderShown)]);
    rows.push(['Month opening', 'savingsDirectedAway', String(opening.savingsDirectedAway)]);
    rows.push(['Month opening', 'carryApplied', String(opening.carryApplied)]);
    if (opening.allocations) {
      rows.push(['Month opening', 'allocations', JSON.stringify(opening.allocations)]);
    }
    rows.push(['Month opening', 'migrated', String(Boolean(opening.migrated))]);
  }

  rows.push(['Meta', 'Export month', mk]);

  return rows.map((r) => r.map((c) => escape(String(c))).join(',')).join('\n');
};
