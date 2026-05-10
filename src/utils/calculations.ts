import type { DebtAccount, EssentialExpense, FinanceState } from '../types/finance';

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

export const combinedMonthlyIncome = (state: FinanceState): number =>
  state.income.husbandMonthly + state.income.wifeMonthly;

export const totalDebtPayments = (debts: DebtAccount[]): number =>
  debts.reduce((s, d) => s + d.monthlyPayment, 0);

/** Treat “no stated balance” installment as payment × months remaining until endsOn */
export const effectiveDebtBalance = (d: DebtAccount, ref: Date = new Date()): number => {
  if (d.balance > 0) return d.balance;
  if (!d.endsOn) return 0;
  const end = new Date(d.endsOn);
  if (Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - ref.getTime();
  if (ms <= 0) return 0;
  const monthsLeft = ms / (1000 * 60 * 60 * 24 * 30.44);
  return Math.max(0, d.monthlyPayment * monthsLeft);
};

export const totalDebtRemaining = (debts: DebtAccount[], ref = new Date()): number =>
  debts.reduce((s, d) => s + effectiveDebtBalance(d, ref), 0);

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
