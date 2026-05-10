/**
 * Simple interest-at-rest estimate: APR ÷ 12 × balance.
 * Cards accrue oddly in real life; this is directional only — we never mutate stored balances from it.
 */
export const estimatedMonthlyInterestFromApr = (balance: number, annualAprPercent: number): number => {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  if (!Number.isFinite(annualAprPercent) || annualAprPercent <= 0) return 0;
  return (balance * annualAprPercent) / 100 / 12;
};
