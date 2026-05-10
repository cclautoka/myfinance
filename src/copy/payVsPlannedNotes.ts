import { formatMoney } from '../utils/format';

/**
 * Short, literal copy for Pay logged vs Household monthly total (no jargon like “live month”).
 */
export function payLoggedVersusPlannedLine(planned: number, logged: number): string {
  if (!Number.isFinite(planned) || !Number.isFinite(logged)) {
    return 'Compare Household monthly income with deposits you logged this calendar month.';
  }
  if (logged <= 0) {
    return 'No deposits logged for this month yet — the total stays at zero until you add rows in Paycheque log.';
  }
  if (logged >= planned) {
    return `Logged deposits total at least your Household monthly income (${formatMoney(planned)}). That means this month’s pay you entered matches or beats the monthly figure in your plan.`;
  }
  const shortBy = planned - logged;
  return `You logged ${formatMoney(logged)} so far this month. Your Household monthly income total is ${formatMoney(planned)} — so right now you're ${formatMoney(shortBy)} behind that monthly figure with what’s entered in the Paycheque log. You might still deposit more paychecks before the month ends — or incomes this month are simply lower than the plan — both are normal.`;
}
