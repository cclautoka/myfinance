import type { FinanceState } from '../types/finance';

/** Sum of paycheques / deposits logged for a calendar month (not the same as “extra cash”). */
export const incomeLogMonthTotal = (state: FinanceState, monthKey: string): number => {
  const [y, m] = monthKey.split('-').map(Number);
  return state.incomeLog
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    })
    .reduce((s, e) => s + e.amount, 0);
};
