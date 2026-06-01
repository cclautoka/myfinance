import type { FinanceState } from '../types/finance';
import {
  billOccurrenceIsPaid,
  billOccurrencePaidDisplayAmount,
  billPaidStoredAmount,
  timelineOccurrencesDueInCalendarMonth,
} from './billsTimeline';
import { startOfLocalDay } from './businessDays';
import { currentMonthKey } from '../data/defaults';
import { extraIncomeMonthTotal, surpriseExpensesMonthTotal } from './calculations';
import { incomeLogMonthTotal } from './incomeLog';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function totalSurplusSweptForMonth(state: FinanceState, monthKey: string): number {
  return (state.budgetSurplusSweeps ?? []).filter((e) => e.monthKey === monthKey).reduce((s, e) => s + e.amount, 0);
}

/** Optional cushion keyed by month — e.g. last month’s leftovers not logged as paychecks. */
export function monthSpendableCarry(state: FinanceState, monthKey: string): number {
  const v = state.monthSpendableCarryByMonth?.[monthKey];
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/** Paycheque / deposit log rows + “Extra cash” dated in this calendar month. */
export function monthActualIncomeTotal(state: FinanceState, monthKey: string): number {
  return round2(incomeLogMonthTotal(state, monthKey) + extraIncomeMonthTotal(state, monthKey));
}

/** Logged income this month plus any typed carry-in for that month. */
export function monthTotalSpendableIncome(state: FinanceState, monthKey: string): number {
  return round2(monthActualIncomeTotal(state, monthKey) + monthSpendableCarry(state, monthKey));
}

/**
 * Bill-calendar lines dated in this month that you marked handled, using recorded “actual paid”
 * amounts when present, plus Unexpected expenses dated this month.
 */
export function monthActualExpenseTotal(state: FinanceState, monthKey: string): number {
  const occ = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  let billsPaid = 0;
  for (const b of occ) {
    if (!billOccurrenceIsPaid(state, b)) continue;
    billsPaid += billOccurrencePaidDisplayAmount(state, b, b.amount);
  }
  return round2(billsPaid + surpriseExpensesMonthTotal(state, monthKey));
}

/**
 * Handled bills/surprises counted for “pocket left so far” — only occurrences due on or before `ref`
 * (default today) so future-dated lines do not reduce pocket early.
 */
export function monthActualExpenseSoFarForPocket(
  state: FinanceState,
  monthKey: string,
  ref: Date = new Date(),
): number {
  const endOfToday = startOfLocalDay(ref).getTime();
  const occ = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  let billsPaid = 0;
  for (const b of occ) {
    if (!billOccurrenceIsPaid(state, b)) continue;
    if (startOfLocalDay(b.due).getTime() > endOfToday) continue;
    billsPaid += billOccurrencePaidDisplayAmount(state, b, b.amount);
  }
  const [y, m] = monthKey.split('-').map(Number);
  let surprises = 0;
  for (const e of state.surpriseExpenses) {
    const d = new Date(e.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    if (startOfLocalDay(d).getTime() > endOfToday) continue;
    surprises += e.amount;
  }
  return round2(billsPaid + surprises);
}

/** Logged pay + extra only, minus outflows (ignores carry-in). */
export function monthActualNetCashflow(state: FinanceState, monthKey: string): number {
  return round2(monthActualIncomeTotal(state, monthKey) - monthActualExpenseTotal(state, monthKey));
}

/** Net after including optional carry-in (drives sweep cap). */
export function monthAdjustedNetCashflow(state: FinanceState, monthKey: string): number {
  return round2(monthTotalSpendableIncome(state, monthKey) - monthActualExpenseTotal(state, monthKey));
}

/**
 * Spendable surplus for the month (incl. carry) minus sweeps already applied; floors at zero.
 */
export function surplusSweepRoomRemaining(state: FinanceState, monthKey: string): number {
  const net = monthAdjustedNetCashflow(state, monthKey);
  if (net <= 0) return 0;
  return Math.max(0, round2(net - totalSurplusSweptForMonth(state, monthKey)));
}

/** Savings goal ring balances allocated from the emergency pool — treated as set aside from pocket. */
export function savingsGoalsAllocatedTotal(state: FinanceState): number {
  const rows = state.savingsGoals ?? [];
  return round2(rows.reduce((s, g) => s + (Number(g.balance) || 0), 0));
}

/**
 * Dashboard “pocket left”: paycheck deposits this month − counted spend so far.
 * Carry-in is shown separately; goal ring balances are not subtracted here.
 */
export function pocketLeftSoFar(state: FinanceState, monthKey?: string, ref: Date = new Date()): number {
  const mk = monthKey ?? currentMonthKey();
  return round2(incomeLogMonthTotal(state, mk) - monthActualExpenseSoFarForPocket(state, mk, ref));
}

/**
 * Prior-month spendable slack for month-opening carry — checking cushion left after pay, spend, and sweeps.
 */
export function monthPocketSlackForRollover(state: FinanceState, monthKey: string): number {
  const net = round2(
    monthSpendableCarry(state, monthKey) +
      incomeLogMonthTotal(state, monthKey) -
      monthActualExpenseTotal(state, monthKey),
  );
  if (net <= 0) return 0;
  return Math.max(0, round2(net - totalSurplusSweptForMonth(state, monthKey)));
}

export type MonthOpeningAllocationInput = {
  emergency?: number;
  goals?: Record<string, number>;
};

/** Sum of dollars directed to emergency + savings goals at month open (capped by caller). */
export function totalMonthOpeningAllocation(input: MonthOpeningAllocationInput): number {
  let sum = Math.max(0, Number(input.emergency) || 0);
  if (!Number.isFinite(sum)) sum = 0;
  for (const v of Object.values(input.goals ?? {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return round2(sum);
}

export type MonthCashflowIncomeLine = {
  id: string;
  source: 'paycheque' | 'extra' | 'carry';
  label: string;
  date: string;
  amount: number;
};

export type MonthCashflowExpenseLine = {
  id: string;
  source: 'bill_paid' | 'surprise';
  label: string;
  date: string;
  amount: number;
  /** Bill row plan amount; omitted for surprises */
  plannedAmount?: number;
  /** True when “actual paid” was stored for that calendar line */
  usedStoredActual: boolean;
};

function monthKeyMatch(dateStr: string, year: number, month1to12: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() + 1 === month1to12;
}

/** Line items backing cashflow totals (includes carry row when typed). */
export function monthCashflowBreakdownLines(
  state: FinanceState,
  monthKey: string,
): { income: MonthCashflowIncomeLine[]; expenses: MonthCashflowExpenseLine[] } {
  const [y, m] = monthKey.split('-').map(Number);
  const income: MonthCashflowIncomeLine[] = [];

  const carry = monthSpendableCarry(state, monthKey);
  if (carry > 0) {
    income.push({
      id: `carry-${monthKey}`,
      source: 'carry',
      label: 'From earlier · not paychecks this month',
      date: `${monthKey}-01`,
      amount: carry,
    });
  }

  for (const e of state.incomeLog) {
    if (!monthKeyMatch(e.date, y, m)) continue;
    income.push({
      id: e.id,
      source: 'paycheque',
      label: e.label ? `${e.label} · ${e.earner}` : e.earner,
      date: e.date,
      amount: round2(e.amount),
    });
  }
  for (const e of state.extraIncome) {
    if (!monthKeyMatch(e.date, y, m)) continue;
    income.push({
      id: e.id,
      source: 'extra',
      label: e.label || e.category,
      date: e.date,
      amount: round2(e.amount),
    });
  }
  income.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source) || a.label.localeCompare(b.label));

  const expenses: MonthCashflowExpenseLine[] = [];
  const occ = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  for (const b of occ) {
    if (!billOccurrenceIsPaid(state, b)) continue;
    const stored = billPaidStoredAmount(state, b) !== undefined;
    const amount = round2(billOccurrencePaidDisplayAmount(state, b, b.amount));
    expenses.push({
      id: `bill-${b.id}`,
      source: 'bill_paid',
      label: b.name,
      date: b.due.toISOString().slice(0, 10),
      amount,
      plannedAmount: round2(b.amount),
      usedStoredActual: stored,
    });
  }
  for (const e of state.surpriseExpenses) {
    if (!monthKeyMatch(e.date, y, m)) continue;
    expenses.push({
      id: e.id,
      source: 'surprise',
      label: e.label || e.category,
      date: e.date,
      amount: round2(e.amount),
      usedStoredActual: false,
    });
  }
  expenses.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  return { income, expenses };
}
