import { formatMoney } from '../utils/format';

/**
 * Helper under Deposits this month — compares logged pay to Household monthly plan.
 */
export function payLoggedVersusPlannedLine(planned: number, logged: number): string {
  if (!Number.isFinite(planned) || !Number.isFinite(logged)) {
    return 'Compare Household monthly income with pay you log this calendar month.';
  }
  if (logged <= 0) {
    return 'No pay logged this month yet. Add rows in the Paycheque log below.';
  }
  if (logged >= planned) {
    return `Logged pay is at least your planned monthly income (${formatMoney(planned)}).`;
  }
  const shortBy = planned - logged;
  return `You have logged ${formatMoney(logged)} so far. Planned monthly income is ${formatMoney(planned)}, so you are ${formatMoney(shortBy)} short of the plan on paper. You may still receive more pay this month, or income may genuinely be lower. Both are normal.`;
}
