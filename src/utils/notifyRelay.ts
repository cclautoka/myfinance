import type { FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import { combinedMonthlyIncome, totalDebtRemaining } from './calculations';
import { formatMoney } from './format';
import { readNotifyRelayConfig } from './notifyRelayConfig';

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

export async function postNotifyRelay(summary: string, subject?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { enabled, url, secret } = readNotifyRelayConfig();
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
      ...(subject ? { subject } : {}),
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: t || `HTTP ${res.status}` };
  }
  return { ok: true };
}
