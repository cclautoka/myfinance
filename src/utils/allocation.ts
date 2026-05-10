import type { FinanceState } from '../types/finance';
import {
  combinedMonthlyIncome,
  monthlyEssentialAmount,
  totalDebtPayments,
  weeklyAmountToMonthlyPlan,
} from './calculations';

export interface AllocationBreakdown {
  income: number;
  /** Rent, utilities, etc. from Household data (monthly + weekly→4 weeks), excluding groceries row */
  essentials: number;
  /** Groceries row only: weekly × 4 weeks (see calculations) or monthly amount */
  groceries: number;
  /** Sum of “Payment” column in debts — what you actually pay */
  debt: number;
  savings: number;
  personal: number;
  totalAllocated: number;
  remainder: number;
  pctSum: number;
  /** What the sliders would be in dollars (for comparison only — not added on top of table amounts) */
  sliderDollars: { essentials: number; groceries: number; debt: number; savings: number; personal: number };
}

export const allocationBreakdown = (state: FinanceState): AllocationBreakdown => {
  const income = combinedMonthlyIncome(state);
  const pctSum =
    state.allocation.essentials +
    state.allocation.groceries +
    state.allocation.debt +
    state.allocation.savings +
    state.allocation.personal;

  const nonFood = state.essentials.filter((e) => e.id !== 'food');
  const food = state.essentials.find((e) => e.id === 'food');

  const essentials = monthlyEssentialAmount(nonFood);
  const groceries = food
    ? food.cadence === 'week'
      ? weeklyAmountToMonthlyPlan(food.amount)
      : food.amount
    : 0;

  const debt = totalDebtPayments(state.debts);
  const savings = Math.max(0, Number(state.plannedSavingsMonthly) || 0);
  const personal = Math.max(0, Number(state.plannedPersonalMonthly) || 0);

  const sliderDollars = {
    essentials: (state.allocation.essentials / 100) * income,
    groceries: (state.allocation.groceries / 100) * income,
    debt: (state.allocation.debt / 100) * income,
    savings: (state.allocation.savings / 100) * income,
    personal: (state.allocation.personal / 100) * income,
  };

  const totalAllocated = essentials + groceries + debt + savings + personal;
  return {
    income,
    essentials,
    groceries,
    debt,
    savings,
    personal,
    totalAllocated,
    remainder: income - totalAllocated,
    pctSum,
    sliderDollars,
  };
};
