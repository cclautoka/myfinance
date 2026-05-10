import type { FinanceState } from '../types/finance';
import { totalDebtRemaining } from './calculations';

/** Simple linear estimate: total balance ÷ sum of monthly payments (optimistic). */
export const estimatedDebtFreeMonths = (state: FinanceState, ref = new Date()): number | null => {
  const total = totalDebtRemaining(state.debts, ref);
  if (total <= 0) return 0;
  const pay = state.debts.reduce((s, d) => s + d.monthlyPayment, 0);
  if (pay <= 0) return null;
  return Math.ceil(total / pay);
};

export const estimatedDebtFreeDate = (state: FinanceState, ref = new Date()): Date | null => {
  const m = estimatedDebtFreeMonths(state, ref);
  if (m === null) return null;
  const d = new Date(ref);
  d.setMonth(d.getMonth() + m);
  return d;
};
