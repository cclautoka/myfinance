import type { DebtAccount, FinanceState } from '../types/finance';

const setDaySafe = (year: number, monthIndex: number, day: number): Date => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const d = Math.min(day, last);
  return new Date(year, monthIndex, d);
};

const monthKey = (ref: Date): string =>
  `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;

/**
 * After the due date passes in the calendar month, **auto-deduction** debts are marked handled
 * for that month — unless `billsAutoUnmarked` says this household tapped “Undo handled” for that bill.
 */
export function applyAutoMarkHandled(state: FinanceState, ref: Date = new Date()): FinanceState {
  const mk = monthKey(ref);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const todayStart = new Date(y, m, ref.getDate()).getTime();

  const billsPaid = { ...state.billsPaid };
  const billPaidAmounts = { ...(state.billPaidAmounts ?? {}) };
  const unmarked = state.billsAutoUnmarked ?? {};

  for (const d of state.debts) {
    if (!d.autoDeduction || d.monthlyPayment <= 0) continue;
    if ((unmarked[d.id] ?? []).includes(mk)) continue;

    const due = setDaySafe(y, m, d.dueDay);
    if (d.endsOn) {
      const end = new Date(d.endsOn);
      if (Number.isNaN(end.getTime())) continue;
      if (due.getTime() > end.getTime()) continue;
    }

    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    if (todayStart >= dueStart) {
      const cur = new Set(billsPaid[d.id] ?? []);
      cur.add(mk);
      billsPaid[d.id] = [...cur];
      const inner = { ...(billPaidAmounts[d.id] ?? {}) };
      inner[mk] = d.monthlyPayment;
      billPaidAmounts[d.id] = inner;
    }
  }

  return { ...state, billsPaid, billPaidAmounts };
}

/** True if toggling unpaid should record an opt-out so auto-fill does not return next load. */
export const debtIsAutoDeduction = (debts: DebtAccount[], billId: string): boolean =>
  debts.some((d) => d.id === billId && d.autoDeduction && d.monthlyPayment > 0);
