import type { DebtAccount } from '../types/finance';
import { effectiveDebtBalance } from './calculations';

export interface SnowballRow {
  debt: DebtAccount;
  effectiveBalance: number;
  snowballOrder: number;
}

/** Smallest effective balance first (classic snowball). */
export const snowballOrder = (debts: DebtAccount[], ref = new Date()): SnowballRow[] => {
  const rows: SnowballRow[] = debts.map((d) => ({
    debt: d,
    effectiveBalance: effectiveDebtBalance(d, ref),
    snowballOrder: 0,
  }));

  const active = rows.filter((r) => r.effectiveBalance > 0);
  active.sort(
    (a, b) =>
      a.effectiveBalance - b.effectiveBalance || a.debt.name.localeCompare(b.debt.name),
  );
  active.forEach((r, i) => {
    r.snowballOrder = i + 1;
  });

  return [...rows].sort((a, b) => {
    if (a.snowballOrder === 0 && b.snowballOrder !== 0) return 1;
    if (b.snowballOrder === 0 && a.snowballOrder !== 0) return -1;
    if (a.snowballOrder !== b.snowballOrder) return a.snowballOrder - b.snowballOrder;
    return a.debt.name.localeCompare(b.debt.name);
  });
};

export const snowballHead = (debts: DebtAccount[], ref = new Date()): DebtAccount | null => {
  const o = snowballOrder(debts, ref).find((r) => r.snowballOrder === 1);
  return o?.debt ?? null;
};

/** If a small debt is almost gone, hint redirect of its payment to the snowball head. */
export const endingSoonRedirect = (
  debts: DebtAccount[],
  ref = new Date(),
): { ending: DebtAccount; redirectAmount: number; target: DebtAccount } | null => {
  const head = snowballHead(debts, ref);
  if (!head) return null;

  for (const d of debts) {
    if (!d.endsOn) continue;
    const end = new Date(d.endsOn);
    const ms = end.getTime() - ref.getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    if (days >= 0 && days <= 62 && d.monthlyPayment > 0 && d.id !== head.id) {
      return { ending: d, redirectAmount: d.monthlyPayment, target: head };
    }
  }
  return null;
};
