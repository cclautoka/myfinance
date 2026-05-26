import type {
  AllocationPercents,
  DebtAccount,
  EssentialExpense,
  FinanceState,
  IncomeConfig,
} from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { formatMoney } from './format';

export type DigestListItem = { title: string; body?: string; meta?: string };
export type DigestSection = { heading: string; body?: string; items?: DigestListItem[] };

const MAX_ITEMS = 32;

function money(n: number): string {
  return formatMoney(Number.isFinite(n) ? n : 0);
}

function pushItem(items: DigestListItem[], title: string, body?: string, meta?: string) {
  if (items.length >= MAX_ITEMS) return false;
  items.push({ title, body, meta });
  return true;
}

function cmpNum(a: number, b: number): boolean {
  return Math.round(a * 100) !== Math.round(b * 100);
}

function diffIncome(from: IncomeConfig, to: IncomeConfig, items: DigestListItem[]): void {
  const keys: (keyof IncomeConfig)[] = [
    'husbandMonthly',
    'wifeMonthly',
    'husbandPayNote',
    'wifePayNote',
    'husbandPaySchedule',
    'wifePaySchedule',
    'husbandTypicalPerPay',
    'wifeTypicalPerPay',
    'husbandPayAutoLog',
    'wifePayAutoLog',
    'husbandPayAnchor',
    'wifeBiweeklyPayAnchor',
  ];
  for (const k of keys) {
    const a = from[k];
    const b = to[k];
    if (a === b) continue;
    const body =
      typeof a === 'number' && typeof b === 'number'
        ? `${money(a)} → ${money(b)}`
        : `${String(a ?? '')} → ${String(b ?? '')}`;
    if (!pushItem(items, `Income · ${String(k)}`, body)) return;
  }
}

function diffAllocation(from: AllocationPercents, to: AllocationPercents, items: DigestListItem[]): void {
  for (const k of ['essentials', 'debt', 'savings', 'groceries', 'personal'] as const) {
    if (from[k] === to[k]) continue;
    if (!pushItem(items, `Allocation · ${k}`, `${from[k]}% → ${to[k]}%`)) return;
  }
}

function diffEssentialRow(a: EssentialExpense, b: EssentialExpense, items: DigestListItem[]): void {
  if (a.name !== b.name) pushItem(items, `Essential · ${b.name}`, `Name: "${a.name}" → "${b.name}"`);
  if (cmpNum(a.amount, b.amount)) pushItem(items, `Essential · ${b.name}`, `Amount: ${money(a.amount)} → ${money(b.amount)}`);
  if (a.cadence !== b.cadence) pushItem(items, `Essential · ${b.name}`, `Cadence: ${a.cadence} → ${b.cadence}`);
  if ((a.dueDay ?? null) !== (b.dueDay ?? null)) pushItem(items, `Essential · ${b.name}`, `Due day: ${a.dueDay ?? '—'} → ${b.dueDay ?? '—'}`);
  if ((a.weeklyDueWeekday ?? null) !== (b.weeklyDueWeekday ?? null))
    pushItem(items, `Essential · ${b.name}`, `Weekday: ${a.weeklyDueWeekday ?? '—'} → ${b.weeklyDueWeekday ?? '—'}`);
}

function diffDebtRow(a: DebtAccount, b: DebtAccount, items: DigestListItem[]): void {
  if (a.name !== b.name) pushItem(items, `Debt · ${b.name}`, `Name: "${a.name}" → "${b.name}"`);
  if (cmpNum(a.balance, b.balance)) pushItem(items, `Debt · ${b.name}`, `Balance: ${money(a.balance)} → ${money(b.balance)}`);
  if (cmpNum(a.monthlyPayment, b.monthlyPayment))
    pushItem(items, `Debt · ${b.name}`, `Monthly payment: ${money(a.monthlyPayment)} → ${money(b.monthlyPayment)}`);
  if (a.dueDay !== b.dueDay) pushItem(items, `Debt · ${b.name}`, `Due day: ${a.dueDay} → ${b.dueDay}`);
  if (Boolean(a.autoDeduction) !== Boolean(b.autoDeduction))
    pushItem(items, `Debt · ${b.name}`, `Auto-deduct: ${a.autoDeduction} → ${b.autoDeduction}`);
  if ((a.endsOn ?? '') !== (b.endsOn ?? '')) pushItem(items, `Debt · ${b.name}`, `Ends on: ${a.endsOn ?? '—'} → ${b.endsOn ?? '—'}`);
  if (a.kind !== b.kind) pushItem(items, `Debt · ${b.name}`, `Kind: ${a.kind} → ${b.kind}`);
  const aprA = a.annualInterestApr ?? 0;
  const aprB = b.annualInterestApr ?? 0;
  if (cmpNum(aprA, aprB)) pushItem(items, `Debt · ${b.name}`, `APR %: ${aprA} → ${aprB}`);
}

function mapById<T extends { id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) m.set(r.id, r);
  return m;
}

function diffIdRows<T extends { id: string }>(
  label: string,
  fromRows: T[],
  toRows: T[],
  diffRow: (a: T, b: T, items: DigestListItem[]) => void,
  items: DigestListItem[],
): void {
  const aM = mapById(fromRows);
  const bM = mapById(toRows);
  for (const id of new Set([...aM.keys(), ...bM.keys()])) {
    const a = aM.get(id);
    const b = bM.get(id);
    if (!a && b) {
      const name = 'name' in b ? (b as { name: string }).name : id;
      const amt =
        'amount' in b && typeof (b as { amount?: number }).amount === 'number'
          ? money((b as { amount: number }).amount)
          : '';
      pushItem(items, `${label} added`, amt ? `${name} (${amt})` : name);
      continue;
    }
    if (a && !b) {
      const name = 'name' in a ? (a as { name: string }).name : id;
      pushItem(items, `${label} removed`, name);
      continue;
    }
    if (a && b) diffRow(a, b, items);
  }
}

function billLabel(state: FinanceState, billId: string): string {
  const e = state.essentials.find((x) => x.id === billId);
  if (e?.name) return e.name;
  const d = state.debts.find((x) => x.id === billId);
  if (d?.name) return d.name;
  return billId;
}

function formatPeriodKey(key: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return key;
}

function diffBillsPaid(from: FinanceState, to: FinanceState, items: DigestListItem[]): void {
  const ids = new Set([...Object.keys(from.billsPaid ?? {}), ...Object.keys(to.billsPaid ?? {})]);
  for (const id of ids) {
    const aSet = new Set(from.billsPaid?.[id] ?? []);
    const bSet = new Set(to.billsPaid?.[id] ?? []);
    const name = billLabel(to, id);
    for (const k of bSet) {
      if (!aSet.has(k)) pushItem(items, 'Marked as handled', `${name} (${formatPeriodKey(k)})`);
    }
    for (const k of aSet) {
      if (!bSet.has(k)) pushItem(items, 'Unmarked as handled', `${name} (${formatPeriodKey(k)})`);
    }
  }
}

function diffBillPaidAmounts(from: FinanceState, to: FinanceState, items: DigestListItem[]): void {
  const aOuter = from.billPaidAmounts ?? {};
  const bOuter = to.billPaidAmounts ?? {};
  const billIds = new Set([...Object.keys(aOuter), ...Object.keys(bOuter)]);
  for (const bid of billIds) {
    const aIn = aOuter[bid] ?? {};
    const bIn = bOuter[bid] ?? {};
    const keys = new Set([...Object.keys(aIn), ...Object.keys(bIn)]);
    for (const k of keys) {
      const av = aIn[k];
      const bv = bIn[k];
      if (av === bv) continue;
      pushItem(
        items,
        'Actual paid amount',
        `${billLabel(to, bid)} (${formatPeriodKey(k)})`,
        `${av === undefined ? '—' : money(av)} → ${bv === undefined ? '—' : money(bv)}`,
      );
    }
  }
}

function diffStringRecord(
  heading: string,
  from: Record<string, string[]> | undefined,
  to: Record<string, string[]> | undefined,
  items: DigestListItem[],
): void {
  const ids = new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  for (const id of ids) {
    const a = [...(from?.[id] ?? [])].sort().join(',');
    const b = [...(to?.[id] ?? [])].sort().join(',');
    if (a === b) continue;
    pushItem(items, heading, `${id}`, `${a || '—'} → ${b || '—'}`);
  }
}

function diffLogArray<T extends { id: string }>(
  label: string,
  from: T[],
  to: T[],
  describe: (x: T) => string,
  items: DigestListItem[],
): void {
  const aM = mapById(from);
  const bM = mapById(to);
  for (const id of new Set([...aM.keys(), ...bM.keys()])) {
    const a = aM.get(id);
    const b = bM.get(id);
    if (!a && b) {
      pushItem(items, `${label} added`, describe(b));
      continue;
    }
    if (a && !b) {
      pushItem(items, `${label} removed`, describe(a));
      continue;
    }
    if (a && b && JSON.stringify(a) !== JSON.stringify(b)) {
      pushItem(items, `${label} updated`, describe(b), describe(a));
    }
  }
}

function diffMonthOpening(
  mk: string,
  from: FinanceState,
  to: FinanceState,
  items: DigestListItem[],
): void {
  const a = from.monthCashflowOpening?.[mk];
  const b = to.monthCashflowOpening?.[mk];
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (!a && b) {
    pushItem(items, 'Month cashflow opening', `Confirmed for ${mk}`, JSON.stringify(b));
    return;
  }
  if (a && !b) {
    pushItem(items, 'Month cashflow opening', `Cleared for ${mk}`);
    return;
  }
  if (a && b) pushItem(items, 'Month cashflow opening', `Updated for ${mk}`, `${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}

/**
 * Human-facing diff between two finance states (e.g. start vs end of notify debounce window).
 * Caps list size; skips `theme` noise.
 */
export function computeFinanceStateDiff(from: FinanceState, to: FinanceState): {
  sections: DigestSection[];
  truncated: boolean;
} {
  /** Theme is per-device; never diff or email-notify on appearance alone. */
  const fromNorm = { ...from, theme: to.theme };
  const items: DigestListItem[] = [];

  diffIncome(fromNorm.income, to.income, items);

  if (cmpNum(fromNorm.plannedSavingsMonthly, to.plannedSavingsMonthly))
    pushItem(items, 'Plan dollars', `Planned savings / mo: ${money(fromNorm.plannedSavingsMonthly)} → ${money(to.plannedSavingsMonthly)}`);
  if (cmpNum(fromNorm.plannedPersonalMonthly, to.plannedPersonalMonthly))
    pushItem(items, 'Plan dollars', `Planned personal / mo: ${money(fromNorm.plannedPersonalMonthly)} → ${money(to.plannedPersonalMonthly)}`);

  diffAllocation(fromNorm.allocation, to.allocation, items);

  if (cmpNum(fromNorm.wallets.husbandBudget, to.wallets.husbandBudget))
    pushItem(items, 'Wallets', `Husband budget: ${money(fromNorm.wallets.husbandBudget)} → ${money(to.wallets.husbandBudget)}`);
  if (cmpNum(fromNorm.wallets.wifeBudget, to.wallets.wifeBudget))
    pushItem(items, 'Wallets', `Wife budget: ${money(fromNorm.wallets.wifeBudget)} → ${money(to.wallets.wifeBudget)}`);
  if (cmpNum(fromNorm.wallets.husbandSpent, to.wallets.husbandSpent))
    pushItem(items, 'Wallets', `Husband spent: ${money(fromNorm.wallets.husbandSpent)} → ${money(to.wallets.husbandSpent)}`);
  if (cmpNum(fromNorm.wallets.wifeSpent, to.wallets.wifeSpent))
    pushItem(items, 'Wallets', `Wife spent: ${money(fromNorm.wallets.wifeSpent)} → ${money(to.wallets.wifeSpent)}`);

  if (cmpNum(fromNorm.emergencyFund, to.emergencyFund))
    pushItem(items, 'Emergency fund', `${money(fromNorm.emergencyFund)} → ${money(to.emergencyFund)}`);
  if (cmpNum(fromNorm.threeMonthFundTarget, to.threeMonthFundTarget))
    pushItem(items, '3‑month target', `${money(fromNorm.threeMonthFundTarget)} → ${money(to.threeMonthFundTarget)}`);

  const mk = currentMonthKey();
  const carryFrom = fromNorm.monthSpendableCarryByMonth?.[mk];
  const carryTo = to.monthSpendableCarryByMonth?.[mk];
  if (carryFrom !== carryTo) {
    pushItem(
      items,
      'Spendable carry-in',
      mk,
      `${carryFrom === undefined ? '—' : money(Number(carryFrom))} → ${carryTo === undefined ? '—' : money(Number(carryTo))}`,
    );
  }

  const pushFrom = fromNorm.pushNotificationPrefs?.billReminders !== false;
  const pushTo = to.pushNotificationPrefs?.billReminders !== false;
  if (pushFrom !== pushTo) {
    pushItem(items, 'App notifications', `Bill reminder pushes: ${pushFrom ? 'on' : 'off'} → ${pushTo ? 'on' : 'off'}`);
  }

  if ((fromNorm.billOverdueGraceDays ?? 0) !== (to.billOverdueGraceDays ?? 0))
    pushItem(items, 'Bill prefs', `Overdue grace days: ${fromNorm.billOverdueGraceDays ?? 0} → ${to.billOverdueGraceDays ?? 0}`);
  if ((fromNorm.billUpcomingLeadBusinessDays ?? 0) !== (to.billUpcomingLeadBusinessDays ?? 0))
    pushItem(items, 'Bill prefs', `Upcoming lead (business days): ${fromNorm.billUpcomingLeadBusinessDays ?? 0} → ${to.billUpcomingLeadBusinessDays ?? 0}`);

  diffIdRows('Essential', fromNorm.essentials, to.essentials, diffEssentialRow, items);
  diffIdRows('Debt', fromNorm.debts, to.debts, diffDebtRow, items);

  diffBillsPaid(fromNorm, to, items);
  diffBillPaidAmounts(fromNorm, to, items);
  diffStringRecord('Auto-unmark overrides', fromNorm.billsAutoUnmarked, to.billsAutoUnmarked, items);

  diffLogArray(
    'Paycheque log',
    fromNorm.incomeLog,
    to.incomeLog,
    (e) => `${e.date} · ${e.earner} · ${money(e.amount)} · ${e.label}`,
    items,
  );
  diffLogArray(
    'Extra income',
    fromNorm.extraIncome,
    to.extraIncome,
    (e) => `${e.date} · ${money(e.amount)} · ${e.label}`,
    items,
  );
  diffLogArray(
    'Unexpected expenses',
    fromNorm.surpriseExpenses,
    to.surpriseExpenses,
    (e) => `${e.date} · ${money(e.amount)} · ${e.label}`,
    items,
  );
  diffLogArray(
    'Surplus sweeps',
    fromNorm.budgetSurplusSweeps,
    to.budgetSurplusSweeps,
    (e) => `${e.monthKey} · ${money(e.amount)} · ${e.date}`,
    items,
  );

  diffMonthOpening(mk, fromNorm, to, items);

  const truncated = items.length >= MAX_ITEMS;
  const sections: DigestSection[] = [];
  if (items.length > 0) {
    sections.push({
      heading: 'What changed',
      items: items.slice(0, MAX_ITEMS),
    });
  } else {
    sections.push({
      heading: 'What changed',
      body: 'Other workbook settings changed (theme, version, or fields not listed in the audit).',
    });
  }

  if (truncated) {
    sections.push({
      heading: 'Note',
      body: `Some changes were omitted after the first ${MAX_ITEMS} lines. Open the app for the full workbook.`,
    });
  }

  return { sections, truncated };
}
