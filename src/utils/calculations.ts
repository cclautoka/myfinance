import type { DebtAccount, EssentialExpense, FinanceState, IncomeConfig } from '../types/finance';
import { unpaidDebtContractRemaining, debtCalendarFullyPaid } from './billsTimeline';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * For weekly line items we use **4 weeks per month** so $150/week → $600/mo
 * (common “4 Fridays” mental model). Change here if you prefer calendar averaging.
 */
export const WEEKS_IN_MONTHLY_PLAN = 4;

export const weeklyAmountToMonthlyPlan = (weeklyAmount: number): number =>
  weeklyAmount * WEEKS_IN_MONTHLY_PLAN;

/** Monthly equivalent for essentials list (uses {@link WEEKS_IN_MONTHLY_PLAN} for weekly rows). */
export const monthlyEssentialAmount = (items: EssentialExpense[]): number =>
  items.reduce((sum, e) => {
    const m = e.cadence === 'week' ? weeklyAmountToMonthlyPlan(e.amount) : e.amount;
    return sum + m;
  }, 0);

export const otherPlannedIncomeTotal = (income: IncomeConfig): number => {
  const rows = income.otherPlannedIncome;
  if (rows?.length) {
    return rows.reduce((sum, row) => {
      const a = Number(row.amount);
      return sum + (Number.isFinite(a) && a > 0 ? a : 0);
    }, 0);
  }
  const legacy = income.otherPlannedMonthly ?? 0;
  return Number.isFinite(legacy) && legacy > 0 ? legacy : 0;
};

export const combinedMonthlyIncome = (state: FinanceState): number =>
  state.income.husbandMonthly + state.income.wifeMonthly + otherPlannedIncomeTotal(state.income);

export const totalDebtPayments = (debts: DebtAccount[]): number =>
  debts.reduce((s, d) => s + d.monthlyPayment, 0);

/** Effective balance — typed amount, or unpaid HP/loan schedule when `endsOn` is set. */
export const effectiveDebtBalance = (
  d: DebtAccount,
  ref: Date = new Date(),
  state?: FinanceState,
): number => {
  if (state && d.endsOn && d.monthlyPayment > 0 && debtCalendarFullyPaid(state, d)) return 0;
  if (d.balance > 0) return round2(d.balance);
  if (!d.endsOn) return 0;
  if (state && d.monthlyPayment > 0) {
    return unpaidDebtContractRemaining(state, d);
  }
  const end = new Date(d.endsOn);
  if (Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - ref.getTime();
  if (ms <= 0) return 0;
  const monthsLeft = ms / (1000 * 60 * 60 * 24 * 30.44);
  return round2(Math.max(0, d.monthlyPayment * monthsLeft));
};

export const totalDebtRemaining = (
  debts: DebtAccount[],
  ref = new Date(),
  state?: FinanceState,
): number =>
  round2(debts.reduce((s, d) => s + effectiveDebtBalance(d, ref, state), 0));

/** Min payment capped at what is actually left — last installment may be smaller than the plan row. */
export const effectiveMinPayment = (
  d: DebtAccount,
  ref: Date = new Date(),
  state?: FinanceState,
): number => {
  const bal = effectiveDebtBalance(d, ref, state);
  if (bal <= 0 || d.monthlyPayment <= 0) return 0;
  return round2(Math.min(d.monthlyPayment, bal));
};

export const extraIncomeMonthTotal = (state: FinanceState, monthKey: string): number => {
  const [y, m] = monthKey.split('-').map(Number);
  return state.extraIncome
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    })
    .reduce((s, e) => s + e.amount, 0);
};

export const surpriseExpensesMonthTotal = (state: FinanceState, monthKey: string): number => {
  const [y, m] = monthKey.split('-').map(Number);
  return state.surpriseExpenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    })
    .reduce((s, e) => s + e.amount, 0);
};
