import type {
  BillPaymentAttribution,
  DebtAccount,
  FinanceState,
  SurprisePaidByRole,
} from '../types/finance';
import { getClientPlatform } from './clientPlatform';

const setDaySafe = (year: number, monthIndex: number, day: number): Date => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const d = Math.min(day, last);
  return new Date(year, monthIndex, d);
};

const monthKey = (ref: Date): string =>
  `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;

export function autoDeductionPaidByRole(debt: DebtAccount): SurprisePaidByRole {
  return debt.autoDeductionPaidByRole ?? 'owner';
}

function attributionEntry(role: SurprisePaidByRole): BillPaymentAttribution {
  return {
    role,
    platform: getClientPlatform(),
    at: new Date().toISOString(),
  };
}

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
  const billPaymentAttribution = { ...(state.billPaymentAttribution ?? {}) };
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

      const attrInner = { ...(billPaymentAttribution[d.id] ?? {}) };
      if (!attrInner[mk]?.role) {
        attrInner[mk] = attributionEntry(autoDeductionPaidByRole(d));
        billPaymentAttribution[d.id] = attrInner;
      }
    }
  }

  return { ...state, billsPaid, billPaidAmounts, billPaymentAttribution };
}

/** Backfill Primary/Partner tags on auto-marked bills that predate attribution. */
export function syncAutoDeductionBillAttribution(state: FinanceState): FinanceState {
  const billPaymentAttribution = { ...(state.billPaymentAttribution ?? {}) };
  let changed = false;

  for (const d of state.debts) {
    if (!d.autoDeduction || d.monthlyPayment <= 0) continue;
    const role = autoDeductionPaidByRole(d);
    const paidKeys = state.billsPaid[d.id] ?? [];
    if (!paidKeys.length) continue;

    let attrInner = billPaymentAttribution[d.id];
    for (const payKey of paidKeys) {
      if (attrInner?.[payKey]?.role) continue;
      if (!attrInner) attrInner = {};
      attrInner = { ...attrInner, [payKey]: attributionEntry(role) };
      changed = true;
    }
    if (attrInner && Object.keys(attrInner).length) {
      billPaymentAttribution[d.id] = attrInner;
    }
  }

  return changed ? { ...state, billPaymentAttribution } : state;
}

/** True if toggling unpaid should record an opt-out so auto-fill does not return next load. */
export const debtIsAutoDeduction = (debts: DebtAccount[], billId: string): boolean =>
  debts.some((d) => d.id === billId && d.autoDeduction && d.monthlyPayment > 0);
