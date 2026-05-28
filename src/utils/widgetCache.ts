import type { FinanceState, SavingsGoal } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { buildBillsHeadsUpSections } from './reminderEmailPayloadClient';
import { monthIncomeSpendSummary } from './householdIncomeSpend';

export type WidgetBillItem = {
  label: string;
  dueDateIso: string;
  amount: number;
};

export type WidgetGoalItem = {
  id: string;
  name: string;
  progressPct: number;
  balance: number;
  target: number;
};

export type WidgetIncomeVsSpend = {
  monthKey: string;
  primaryIncome: number;
  partnerIncome: number;
  primarySpent: number;
  partnerSpent: number;
  primaryLeft: number;
  partnerLeft: number;
  primaryOver: number;
  partnerOver: number;
};

export type WidgetCacheV1 = {
  version: 1;
  generatedAtIso: string;
  householdId?: string;
  monthKey: string;
  nextDue: WidgetBillItem | null;
  overdue: WidgetBillItem[];
  goals: WidgetGoalItem[];
  incomeVsSpend: WidgetIncomeVsSpend;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function goalsToWidget(goals: SavingsGoal[]): WidgetGoalItem[] {
  return goals
    .filter((g) => Number(g.targetAmount) > 0)
    .map((g) => {
      const bal = round2(Math.max(0, Number(g.balance) || 0));
      const tgt = round2(Math.max(0, Number(g.targetAmount) || 0));
      const pct = tgt > 0 ? clampPct((bal / tgt) * 100) : 0;
      return {
        id: g.id,
        name: String(g.name ?? '').trim() || 'Goal',
        progressPct: round2(pct),
        balance: bal,
        target: tgt,
      };
    })
    .sort((a, b) => b.progressPct - a.progressPct);
}

function parseMoneyFromTitle(title: string): { label: string; amount: number } {
  // Titles look like: "Rent — $400.00"
  const parts = title.split('—').map((s) => s.trim());
  if (parts.length >= 2) {
    const label = parts[0] || title;
    const amt = Number(String(parts[1]).replace(/[^0-9.]/g, ''));
    return { label, amount: round2(Number.isFinite(amt) ? amt : 0) };
  }
  return { label: title, amount: 0 };
}

function toWidgetBillItem(it: { title?: string; body?: string }): WidgetBillItem | null {
  const title = String(it.title ?? '').trim();
  const body = String(it.body ?? '').trim();
  if (!title) return null;
  const dueMatch = body.match(/(\d{4}-\d{2}-\d{2})/);
  const due = dueMatch?.[1] ?? '';
  const { label, amount } = parseMoneyFromTitle(title);
  if (!due) return { label, dueDateIso: '', amount };
  return { label, dueDateIso: due, amount };
}

/** Build a minimal cache payload for native widgets (no secrets, no full state). */
export function buildWidgetCacheV1(state: FinanceState, opts?: { householdId?: string; refDate?: Date }): WidgetCacheV1 {
  const monthKey = currentMonthKey();
  const ref = opts?.refDate ?? new Date();
  const sections = buildBillsHeadsUpSections(state, ref);
  const dueSoon = sections.find((s) => s.heading.toLowerCase().startsWith('due soon'))?.items ?? [];
  const overdueItems = sections.find((s) => s.heading.toLowerCase() === 'overdue')?.items ?? [];

  const overdue = overdueItems
    .map((x) => toWidgetBillItem(x))
    .filter((x): x is WidgetBillItem => Boolean(x && x.label));

  const nextDue =
    dueSoon.map((x) => toWidgetBillItem(x)).find((x): x is WidgetBillItem => Boolean(x && x.label)) ??
    null;

  const summary = monthIncomeSpendSummary(state, monthKey);
  const primary = summary.rows.find((r) => r.key === 'owner');
  const partner = summary.rows.find((r) => r.key === 'partner');

  const incomeVsSpend: WidgetIncomeVsSpend = {
    monthKey,
    primaryIncome: round2(primary?.incomeLogged ?? 0),
    partnerIncome: round2(partner?.incomeLogged ?? 0),
    primarySpent: round2(primary?.spent ?? 0),
    partnerSpent: round2(partner?.spent ?? 0),
    primaryLeft: round2(primary?.remaining ?? 0),
    partnerLeft: round2(partner?.remaining ?? 0),
    primaryOver: round2(primary?.overspend ?? 0),
    partnerOver: round2(partner?.overspend ?? 0),
  };

  return {
    version: 1,
    generatedAtIso: new Date().toISOString(),
    householdId: opts?.householdId,
    monthKey,
    nextDue,
    overdue,
    goals: goalsToWidget(state.savingsGoals ?? []),
    incomeVsSpend,
  };
}

