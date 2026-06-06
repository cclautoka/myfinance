import { currentMonthKey } from '../data/defaults';
import type { FinanceState, SurprisePaidByRole } from '../types/finance';
import { extraIncomeMonthTotal } from './calculations';
import { pocketLeftSoFar } from './budgetSurplus';
import {
  billOccurrenceIsPaid,
  billOccurrencePaidDisplayAmount,
  billPaymentKey,
  timelineOccurrencesDueInCalendarMonth,
} from './billsTimeline';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type IncomeSpendRowKey = 'owner' | 'partner' | 'joint' | 'extra';

export type SpendLineItem = {
  label: string;
  amount: number;
  kind: 'bill' | 'surprise' | 'sweep';
};

export type IncomeSpendRow = {
  key: IncomeSpendRowKey;
  label: string;
  incomeLogged: number;
  spent: number;
  remaining: number;
  overspend: number;
  bills: SpendLineItem[];
  surprises: SpendLineItem[];
  billsTotal: number;
  surprisesTotal: number;
};

export type UnassignedSpend = {
  billsTotal: number;
  bills: SpendLineItem[];
};

export type MonthIncomeSpendSummary = {
  monthKey: string;
  rows: IncomeSpendRow[];
  unassigned: UnassignedSpend;
  chartMax: number;
  /** Matches Dashboard “Left from deposits” — all marked bills due so far, not just attributed ones. */
  householdPocketLeft: number;
};

function billDisplayName(state: FinanceState, billId: string): string {
  const e = state.essentials.find((x) => x.id === billId);
  if (e?.name) return e.name;
  const d = state.debts.find((x) => x.id === billId);
  return d?.name ?? billId;
}

function incomeLoggedByEarner(state: FinanceState, monthKey: string): { husband: number; wife: number; joint: number } {
  const [y, m] = monthKey.split('-').map(Number);
  let husband = 0;
  let wife = 0;
  let joint = 0;
  for (const e of state.incomeLog) {
    const d = new Date(e.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    if (e.earner === 'husband') husband += e.amount;
    else if (e.earner === 'wife') wife += e.amount;
    else if (e.earner === 'joint') joint += e.amount;
  }
  return { husband: round2(husband), wife: round2(wife), joint: round2(joint) };
}

function surprisesForRole(
  state: FinanceState,
  monthKey: string,
  role: SurprisePaidByRole,
): SpendLineItem[] {
  const [y, m] = monthKey.split('-').map(Number);
  const out: SpendLineItem[] = [];
  for (const e of state.surpriseExpenses) {
    if (e.paidByRole !== role) continue;
    const d = new Date(e.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    out.push({ label: e.label, amount: round2(e.amount), kind: 'surprise' });
  }
  return out;
}

function collectAttributedBills(
  state: FinanceState,
  monthKey: string,
  role: SurprisePaidByRole,
): SpendLineItem[] {
  const timeline = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  const out: SpendLineItem[] = [];
  for (const row of timeline) {
    if (!billOccurrenceIsPaid(state, row)) continue;
    const payKey = billPaymentKey(state, row);
    const attr = state.billPaymentAttribution?.[row.billId]?.[payKey];
    if (attr?.role !== role) continue;
    const amount = billOccurrencePaidDisplayAmount(state, row, row.amount);
    const name = billDisplayName(state, row.billId);
    out.push({
      label: payKey.includes('-') && payKey.length > 7 ? `${name} (${payKey})` : name,
      amount: round2(amount),
      kind: 'bill',
    });
  }
  return out;
}

function collectUnassignedBills(state: FinanceState, monthKey: string): SpendLineItem[] {
  const timeline = timelineOccurrencesDueInCalendarMonth(state, monthKey);
  const out: SpendLineItem[] = [];
  for (const row of timeline) {
    if (!billOccurrenceIsPaid(state, row)) continue;
    const payKey = billPaymentKey(state, row);
    const attr = state.billPaymentAttribution?.[row.billId]?.[payKey];
    if (attr?.role === 'owner' || attr?.role === 'partner') continue;
    const amount = billOccurrencePaidDisplayAmount(state, row, row.amount);
    const name = billDisplayName(state, row.billId);
    out.push({
      label: payKey.includes('-') && payKey.length > 7 ? `${name} (${payKey})` : name,
      amount: round2(amount),
      kind: 'bill',
    });
  }
  return out;
}

function buildPersonRow(
  state: FinanceState,
  monthKey: string,
  key: 'owner' | 'partner',
  label: string,
  incomeLogged: number,
): IncomeSpendRow {
  const bills = collectAttributedBills(state, monthKey, key);
  const surprises = surprisesForRole(state, monthKey, key);
  const sweeps = (state.budgetSurplusSweeps ?? [])
    .filter((e) => e.monthKey === monthKey && (e.paidByRole ?? 'owner') === key)
    .map((e) => ({ label: `Sweep to savings (${e.date})`, amount: round2(e.amount), kind: 'sweep' as const }));
  const billsTotal = round2(bills.reduce((s, b) => s + b.amount, 0));
  const surprisesTotal = round2(surprises.reduce((s, b) => s + b.amount, 0));
  const sweepsTotal = round2(sweeps.reduce((s, b) => s + b.amount, 0));
  const spent = round2(billsTotal + surprisesTotal + sweepsTotal);
  const remaining = round2(Math.max(0, incomeLogged - spent));
  const overspend = round2(Math.max(0, spent - incomeLogged));
  return {
    key,
    label,
    incomeLogged,
    spent,
    remaining,
    overspend,
    bills,
    surprises: [...surprises, ...sweeps],
    billsTotal,
    surprisesTotal: round2(surprisesTotal + sweepsTotal),
  };
}

/** Primary / Partner / optional Joint & Extra rows for the income vs spend chart. */
export function monthIncomeSpendSummary(
  state: FinanceState,
  monthKey: string = currentMonthKey(),
): MonthIncomeSpendSummary {
  const logged = incomeLoggedByEarner(state, monthKey);
  const extra = round2(extraIncomeMonthTotal(state, monthKey));

  const rows: IncomeSpendRow[] = [
    buildPersonRow(state, monthKey, 'owner', 'Primary', logged.husband),
    buildPersonRow(state, monthKey, 'partner', 'Partner', logged.wife),
  ];

  if (logged.joint > 0) {
    const bills: SpendLineItem[] = [];
    const surprises: SpendLineItem[] = [];
    rows.push({
      key: 'joint',
      label: 'Joint deposits',
      incomeLogged: logged.joint,
      spent: 0,
      remaining: logged.joint,
      overspend: 0,
      bills,
      surprises,
      billsTotal: 0,
      surprisesTotal: 0,
    });
  }

  if (extra > 0) {
    rows.push({
      key: 'extra',
      label: 'Extra cash',
      incomeLogged: extra,
      spent: 0,
      remaining: extra,
      overspend: 0,
      bills: [],
      surprises: [],
      billsTotal: 0,
      surprisesTotal: 0,
    });
  }

  const unassignedBills = collectUnassignedBills(state, monthKey);
  const unassigned: UnassignedSpend = {
    bills: unassignedBills,
    billsTotal: round2(unassignedBills.reduce((s, b) => s + b.amount, 0)),
  };

  const householdPocketLeft = pocketLeftSoFar(state, monthKey);

  // When one person logged all pay, bar “left” should match household pocket (includes unassigned bills).
  const soleDepositor =
    logged.wife <= 0 && logged.joint <= 0 && extra <= 0 && rows.some((r) => r.key === 'owner');
  if (soleDepositor) {
    const owner = rows.find((r) => r.key === 'owner');
    if (owner) {
      if (householdPocketLeft < 0) {
        owner.remaining = 0;
        owner.overspend = round2(-householdPocketLeft);
      } else {
        owner.remaining = householdPocketLeft;
      }
    }
  }

  const chartMax = Math.max(
    1,
    ...rows.map((r) => Math.max(r.incomeLogged, r.spent)),
    unassigned.billsTotal,
  );

  return { monthKey, rows, unassigned, chartMax, householdPocketLeft };
}
