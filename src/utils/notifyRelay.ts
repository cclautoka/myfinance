import type { FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { combinedMonthlyIncome, totalDebtRemaining } from './calculations';
import { formatMoney } from './format';
import { ensureNotifyRelayHouseholdId, readNotifyRelayConfig } from './notifyRelayConfig';

/** Short plain-text summary for email — not a full state export. */
export function buildFinanceChangeSummary(state: FinanceState): string {
  const mk = currentMonthKey();
  const planned = combinedMonthlyIncome(state);
  const debt = totalDebtRemaining(state.debts);
  const lines = [
    `Household finances · saved ${new Date().toISOString()}`,
    `Calendar month: ${mk}`,
    `Planned monthly income (combined): ${formatMoney(planned)}`,
    `Est. total debt remaining: ${formatMoney(debt)}`,
    `Essentials rows: ${state.essentials.length} · Debt accounts: ${state.debts.length}`,
    '',
    'Open the app on this device for full detail — this email is only a heads-up.',
  ];
  return lines.join('\n');
}

export function pocketLeftSoFar(state: FinanceState): number {
  const mk = currentMonthKey();
  const [y, m] = mk.split('-').map(Number);
  const logged = (state.incomeLog ?? [])
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  // actualExpenseMonth is computed in UI; avoid importing UI util here. Mirror the broad meaning:
  // marked bills amounts are stored under billPaidAmounts and surprises list.
  const surprise = (state.surpriseExpenses ?? [])
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const paidAmounts = state.billPaidAmounts ?? {};
  let paidTotal = 0;
  for (const id of Object.keys(paidAmounts)) {
    const inner = paidAmounts[id] ?? {};
    const v = inner[mk];
    if (typeof v === 'number' && Number.isFinite(v)) paidTotal += v;
  }
  return logged - (paidTotal + surprise);
}

export function buildSnapshotForReminders(state: FinanceState) {
  return {
    essentials: state.essentials ?? [],
    debts: state.debts ?? [],
    billsPaid: state.billsPaid ?? {},
    billPaidAmounts: state.billPaidAmounts ?? {},
    incomeLog: state.incomeLog ?? [],
    surpriseExpenses: state.surpriseExpenses ?? [],
    billOverdueGraceDays: state.billOverdueGraceDays ?? 0,
    billUpcomingLeadBusinessDays: state.billUpcomingLeadBusinessDays ?? 3,
  };
}

export async function postNotifyRelay(
  summary: string,
  opts?: { subject?: string; monthKey?: string; pocketLeft?: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { enabled, url, secret, husbandEmail, wifeEmail } = readNotifyRelayConfig();
  if (!enabled || !url || !secret) return { ok: false, error: 'Notify relay not configured' };

  let parsed: URL;
  try {
    const t = url.trim();
    if (t.startsWith('/')) {
      if (typeof window === 'undefined') return { ok: false, error: 'Invalid notify URL' };
      parsed = new URL(t, window.location.origin);
    } else {
      parsed = new URL(t);
    }
  } catch {
    return { ok: false, error: 'Invalid notify URL' };
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Notify URL must be http(s)' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      summary,
      monthKey: opts?.monthKey ?? currentMonthKey(),
      pocketLeft: opts?.pocketLeft,
      to: [husbandEmail, wifeEmail].filter(Boolean),
      ...(opts?.subject ? { subject: opts.subject } : {}),
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: t || `HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function postSnapshotRelay(data: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { enabled, url, secret } = readNotifyRelayConfig();
  if (!enabled || !url || !secret) return { ok: false, error: 'Notify relay not configured' };
  const base = url.endsWith('/v1/notify') ? url.replace(/\/v1\/notify$/, '') : url.replace(/\/$/, '');
  const snapUrl = `${base}/v1/snapshot`;
  const id = ensureNotifyRelayHouseholdId();
  if (!id) return { ok: false, error: 'No household id' };

  const res = await fetch(snapUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ id, data }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: t || `HTTP ${res.status}` };
  }
  return { ok: true };
}
