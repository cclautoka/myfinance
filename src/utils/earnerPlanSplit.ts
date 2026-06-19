import type { FinanceState } from '../types/finance';
import { allocationBreakdown } from './allocation';
import { plannedMonthlyForEarner } from './expectedPaycheque';

/** How household plan dollars overlay each earner when costs are modeled as funded in proportion to planned salary. */
export type EarnerHouseholdPlanSplit = {
  husbandIncome: number;
  wifeIncome: number;
  combinedIncome: number;
  husbandIncomeShare: number;
  wifeIncomeShare: number;
  /** Dollar total the plan assigns (essentials + groceries + debt + savings + personal). */
  totalPlanOut: number;
  /** That total × this earner’s income share — “their portion” of the joint plan. */
  husbandAttributedPlan: number;
  wifeAttributedPlan: number;
  /** Planned pay minus attributed plan (two cells sum to household remainder). */
  husbandLeftInModel: number;
  wifeLeftInModel: number;
  remainder: number;
};

export function earnerHouseholdPlanSplit(state: FinanceState): EarnerHouseholdPlanSplit {
  const br = allocationBreakdown(state);
  const H = Math.max(0, plannedMonthlyForEarner(state.income, 'husband'));
  const W = Math.max(0, plannedMonthlyForEarner(state.income, 'wife'));
  const C = br.income;
  const hShare = C > 0 ? H / C : 0;
  const wShare = C > 0 ? W / C : 0;
  const totalOut = br.totalAllocated;
  const hAttr = totalOut * hShare;
  const wAttr = totalOut * wShare;
  return {
    husbandIncome: H,
    wifeIncome: W,
    combinedIncome: C,
    husbandIncomeShare: hShare,
    wifeIncomeShare: wShare,
    totalPlanOut: totalOut,
    husbandAttributedPlan: hAttr,
    wifeAttributedPlan: wAttr,
    husbandLeftInModel: H - hAttr,
    wifeLeftInModel: W - wAttr,
    remainder: br.remainder,
  };
}
