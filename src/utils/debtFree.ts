import type { DebtAccount, FinanceState } from '../types/finance';
import { currentMonthKey, previousCalendarMonthKey } from '../data/defaults';
import { effectiveDebtBalance } from './calculations';
import { estimatedMonthlyInterestFromApr } from './debtInterest';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type DebtPayoffSimOptions = {
  /** Extra spend added to every card balance each simulated month (scenario slider). */
  extraCardSpendPerMonth?: number;
  /** Cap simulation length (default 600 months). */
  maxMonths?: number;
  /** When set, HP/loan balances use marked bill calendar payments. */
  state?: FinanceState;
};

export type DebtPayoffSchedulePoint = {
  monthIndex: number;
  monthLabel: string;
  totalBalance: number;
  totalPayment: number;
};

export type DebtPayoffSimResult = {
  months: number | null;
  debtFreeDate: Date | null;
  schedule: DebtPayoffSchedulePoint[];
  includedDebtIds: string[];
};

type SimDebt = {
  id: string;
  name: string;
  kind: DebtAccount['kind'];
  balance: number;
  payment: number;
  apr: number;
  endsOn: Date | null;
};

function monthLabelFromRef(ref: Date, monthOffset: number): string {
  const d = new Date(ref.getFullYear(), ref.getMonth() + monthOffset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function debtEndsOnDate(d: DebtAccount): Date | null {
  if (!d.endsOn) return null;
  const end = new Date(d.endsOn);
  return Number.isNaN(end.getTime()) ? null : end;
}

/** Debts that participate in payoff simulation (payment > 0 and positive effective balance). */
export function debtsIncludedInPayoffSim(
  debts: DebtAccount[],
  ref = new Date(),
  state?: FinanceState,
): DebtAccount[] {
  return debts.filter((d) => d.monthlyPayment > 0 && effectiveDebtBalance(d, ref, state) > 0);
}

function initSimDebts(debts: DebtAccount[], ref: Date, state?: FinanceState): SimDebt[] {
  return debtsIncludedInPayoffSim(debts, ref, state).map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    balance: round2(effectiveDebtBalance(d, ref, state)),
    payment: round2(d.monthlyPayment),
    apr: d.annualInterestApr ?? 0,
    endsOn: debtEndsOnDate(d),
  }));
}

function simMonthStillActive(row: SimDebt, ref: Date, monthOffset: number): boolean {
  if (row.endsOn) {
    const simMonthStart = new Date(ref.getFullYear(), ref.getMonth() + monthOffset, 1);
    const endMonthStart = new Date(row.endsOn.getFullYear(), row.endsOn.getMonth(), 1);
    if (simMonthStart.getTime() > endMonthStart.getTime()) return false;
  }
  return row.balance > 0 || row.payment > 0;
}

function applySimMonth(
  rows: SimDebt[],
  ref: Date,
  monthOffset: number,
  extraCardSpendPerMonth: number,
): number {
  let totalPayment = 0;
  for (const row of rows) {
    if (!simMonthStillActive(row, ref, monthOffset)) {
      row.balance = 0;
      continue;
    }

    if (row.kind === 'card' && extraCardSpendPerMonth > 0) {
      row.balance = round2(row.balance + extraCardSpendPerMonth);
    }

    if (row.apr > 0 && row.balance > 0) {
      row.balance = round2(row.balance + estimatedMonthlyInterestFromApr(row.balance, row.apr));
    }

    const pay = Math.min(row.payment, row.balance);
    if (pay > 0) {
      row.balance = round2(Math.max(0, row.balance - pay));
      totalPayment += pay;
    }

    if (row.endsOn) {
      const simMonthStart = new Date(ref.getFullYear(), ref.getMonth() + monthOffset, 1);
      const endMonthStart = new Date(row.endsOn.getFullYear(), row.endsOn.getMonth(), 1);
      if (simMonthStart.getTime() >= endMonthStart.getTime()) {
        row.balance = 0;
      }
    }
  }
  return round2(totalPayment);
}

function totalSimBalance(rows: SimDebt[]): number {
  return round2(rows.reduce((s, r) => s + Math.max(0, r.balance), 0));
}

/**
 * Month-by-month payoff simulation — cards accrue APR, installments respect endsOn,
 * only debts with payment > 0 are included.
 */
export function simulateDebtPayoff(
  debts: DebtAccount[],
  ref = new Date(),
  opts: DebtPayoffSimOptions = {},
): DebtPayoffSimResult {
  const maxMonths = opts.maxMonths ?? 600;
  const extra = Math.max(0, opts.extraCardSpendPerMonth ?? 0);
  const financeState = opts.state;
  const rows = initSimDebts(debts, ref, financeState);

  if (rows.length === 0) {
    const hasOwed = debts.some((d) => effectiveDebtBalance(d, ref, financeState) > 0);
    const hasPaying = debts.some(
      (d) => d.monthlyPayment > 0 && effectiveDebtBalance(d, ref, financeState) > 0,
    );
    if (hasOwed && !hasPaying) {
      return { months: null, debtFreeDate: null, schedule: [], includedDebtIds: [] };
    }
    return { months: 0, debtFreeDate: ref, schedule: [], includedDebtIds: [] };
  }

  const schedule: DebtPayoffSchedulePoint[] = [];
  const startTotal = totalSimBalance(rows);
  schedule.push({
    monthIndex: 0,
    monthLabel: monthLabelFromRef(ref, 0),
    totalBalance: startTotal,
    totalPayment: 0,
  });

  let months = 0;
  for (let i = 0; i < maxMonths; i += 1) {
    const payment = applySimMonth(rows, ref, i, extra);
    months = i + 1;
    const total = totalSimBalance(rows);
    schedule.push({
      monthIndex: months,
      monthLabel: monthLabelFromRef(ref, months),
      totalBalance: total,
      totalPayment: payment,
    });
    if (total <= 0) {
      const debtFreeDate = new Date(ref.getFullYear(), ref.getMonth() + months, 1);
      return {
        months,
        debtFreeDate,
        schedule,
        includedDebtIds: rows.map((r) => r.id),
      };
    }
  }

  return {
    months: null,
    debtFreeDate: null,
    schedule,
    includedDebtIds: rows.map((r) => r.id),
  };
}

/** Headline months-to-debt-free from simulation (null when no qualifying payments). */
export const estimatedDebtFreeMonths = (state: FinanceState, ref = new Date()): number | null => {
  return simulateDebtPayoff(state.debts, ref, { state }).months;
};

export const estimatedDebtFreeDate = (state: FinanceState, ref = new Date()): Date | null => {
  return simulateDebtPayoff(state.debts, ref, { state }).debtFreeDate;
};

/** Compare baseline vs extra card spend scenario. */
export function debtPayoffScenarioDelta(
  debts: DebtAccount[],
  ref: Date,
  extraCardSpendPerMonth: number,
  state?: FinanceState,
): { baselineMonths: number | null; scenarioMonths: number | null; monthsAdded: number | null } {
  const baseline = simulateDebtPayoff(debts, ref, { state });
  const scenario = simulateDebtPayoff(debts, ref, { extraCardSpendPerMonth, state });
  const monthsAdded =
    baseline.months !== null && scenario.months !== null ? scenario.months - baseline.months : null;
  return {
    baselineMonths: baseline.months,
    scenarioMonths: scenario.months,
    monthsAdded,
  };
}

/** True when any card balance has not been confirmed recently. */
export function staleCardBalanceDebts(debts: DebtAccount[], ref = new Date(), maxAgeDays = 35): DebtAccount[] {
  const cutoff = ref.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return debts.filter((d) => {
    if (d.kind !== 'card') return false;
    if (effectiveDebtBalance(d, ref) <= 0) return false;
    if (!d.balanceUpdatedAt) return true;
    const t = new Date(d.balanceUpdatedAt).getTime();
    return Number.isNaN(t) || t < cutoff;
  });
}

export type DebtFreeMonthsTrendKind = 'unknown' | 'worse' | 'better' | 'unchanged';

/** Compare current payoff months to the snapshot taken at this month’s opening. */
export function debtFreeMonthsTrend(state: FinanceState, ref = new Date()): {
  kind: DebtFreeMonthsTrendKind;
  delta: number | null;
  priorMonths: number | null;
  currentMonths: number | null;
} {
  const currentMonths = estimatedDebtFreeMonths(state, ref);
  const prevMk = previousCalendarMonthKey(currentMonthKey());
  const priorMonths = state.debtFreeProjectionByMonth?.[prevMk]?.months ?? null;

  if (priorMonths === null || currentMonths === null) {
    return { kind: 'unknown', delta: null, priorMonths, currentMonths };
  }

  const delta = currentMonths - priorMonths;
  if (delta > 0) return { kind: 'worse', delta, priorMonths, currentMonths };
  if (delta < 0) return { kind: 'better', delta, priorMonths, currentMonths };
  return { kind: 'unchanged', delta: 0, priorMonths, currentMonths };
}
