import type { DebtAccount } from '../types/finance';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Owed balance from credit limit minus available to spend (bank app “available balance”). */
export function cardOwedFromAvailable(creditLimit: number, availableCredit: number): number {
  const limit = Math.max(0, Number(creditLimit) || 0);
  const avail = Math.max(0, Number(availableCredit) || 0);
  return round2(Math.max(0, limit - avail));
}

/** Available credit when limit and stored owed balance are known. */
export function cardAvailableFromOwed(debt: DebtAccount): number | null {
  const limit = debt.creditLimit;
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return null;
  return round2(Math.max(0, limit - Math.max(0, Number(debt.balance) || 0)));
}

/** Apply a bank-app available figure onto a card row (requires credit limit). */
export function applyCardAvailableCheckIn(
  debt: DebtAccount,
  availableCredit: number,
  creditLimitOverride?: number,
): DebtAccount | null {
  const limit = creditLimitOverride ?? debt.creditLimit;
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return null;
  const safeLimit = round2(Math.max(0, limit));
  const owed = cardOwedFromAvailable(safeLimit, availableCredit);
  return {
    ...debt,
    creditLimit: safeLimit,
    balance: owed,
  };
}
