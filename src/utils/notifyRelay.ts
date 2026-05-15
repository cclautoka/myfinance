import type { FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import {
  combinedMonthlyIncome,
  extraIncomeMonthTotal,
  totalDebtRemaining,
} from './calculations';
import { formatMoney } from './format';
import { ensureNotifyRelayHouseholdId, readNotifyRelayConfig } from './notifyRelayConfig';
import { serverAuthBearer } from './serverAuth';
import {
  monthActualExpenseTotal,
  monthActualIncomeTotal,
  monthSpendableCarry,
  monthTotalSpendableIncome,
} from './budgetSurplus';
import { incomeLogMonthTotal } from './incomeLog';
import { computeFinanceStateDiff, type DigestSection } from './financeStateDiff';
import { buildBillsHeadsUpSections } from './reminderEmailPayloadClient';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const SAVE_EMAIL_DIGEST_VERSION = 1 as const;

export type SaveEmailDigestV1 = {
  version: typeof SAVE_EMAIL_DIGEST_VERSION;
  monthKey: string;
  pocketLeft: number;
  plannedIncomeCombined: number;
  sections: DigestSection[];
};

/** Short plain-text summary for email — legacy / tests; prefer {@link buildSaveEmailDigest}. */
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

/** Dashboard-aligned: paycheque log this month minus counted spend (handled bills + surprises). */
export function pocketLeftSoFar(state: FinanceState): number {
  const mk = currentMonthKey();
  return round2(incomeLogMonthTotal(state, mk) - monthActualExpenseTotal(state, mk));
}

export function buildSaveEmailDigest(from: FinanceState, to: FinanceState): SaveEmailDigestV1 {
  const mk = currentMonthKey();
  const diffSections = computeFinanceStateDiff(from, to).sections;
  const planned = combinedMonthlyIncome(to);
  const logged = incomeLogMonthTotal(to, mk);
  const extraIn = extraIncomeMonthTotal(to, mk);
  const depositsPlusOther = monthActualIncomeTotal(to, mk);
  const carry = monthSpendableCarry(to, mk);
  const spendable = monthTotalSpendableIncome(to, mk);
  const counted = monthActualExpenseTotal(to, mk);
  const pocket = pocketLeftSoFar(to);

  const cashSection: DigestSection = {
    heading: 'This month (cash snapshot)',
    items: [
      { title: 'Planned monthly income (combined)', body: formatMoney(planned) },
      { title: 'Deposits logged (paycheques)', body: formatMoney(logged) },
      { title: 'Other income this month', body: formatMoney(extraIn) },
      { title: 'Deposits + other income', body: formatMoney(depositsPlusOther) },
      { title: 'Typed carry-in this month', body: formatMoney(carry) },
      { title: 'Spendable (deposits + other + carry)', body: formatMoney(spendable) },
      { title: 'Counted spend (handled bills + surprises)', body: formatMoney(counted) },
      {
        title: 'Pocket left (deposits − counted spend)',
        body: formatMoney(pocket),
        meta: 'Same as dashboard “pocket left so far”.',
      },
    ],
  };

  const billSections = buildBillsHeadsUpSections(to);

  return {
    version: SAVE_EMAIL_DIGEST_VERSION,
    monthKey: mk,
    pocketLeft: pocket,
    plannedIncomeCombined: planned,
    sections: [...diffSections, cashSection, ...billSections],
  };
}

/** Plain-text fallback for legacy clients and server validation when digest is present. */
export function digestPlainTextSummary(digest: SaveEmailDigestV1): string {
  const lines: string[] = [
    `Household finances · saved ${new Date().toISOString()}`,
    `Calendar month: ${digest.monthKey}`,
    `Planned income (combined): ${formatMoney(digest.plannedIncomeCombined)}`,
    `Pocket left: ${formatMoney(digest.pocketLeft)}`,
    '',
  ];
  for (const sec of digest.sections) {
    lines.push(`== ${sec.heading} ==`);
    if (sec.body) lines.push(sec.body);
    if (sec.items?.length) {
      for (const it of sec.items) {
        lines.push(`- ${it.title}${it.body ? ` — ${it.body}` : ''}${it.meta ? ` (${it.meta})` : ''}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').slice(0, 7500);
}

/** Husband then wife — trimmed, deduped (max 5) — stored on snapshot for server reminder mail. */
function notifyRecipientEmailsFromRelay(): string[] {
  const { husbandEmail, wifeEmail } = readNotifyRelayConfig();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [husbandEmail, wifeEmail]) {
    const s = (raw ?? '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 5) break;
  }
  return out;
}

export function buildSnapshotForReminders(state: FinanceState) {
  const emails = typeof window !== 'undefined' ? notifyRecipientEmailsFromRelay() : [];
  return {
    essentials: state.essentials ?? [],
    debts: state.debts ?? [],
    billsPaid: state.billsPaid ?? {},
    billPaidAmounts: state.billPaidAmounts ?? {},
    incomeLog: state.incomeLog ?? [],
    surpriseExpenses: state.surpriseExpenses ?? [],
    billOverdueGraceDays: state.billOverdueGraceDays ?? 0,
    billUpcomingLeadBusinessDays: state.billUpcomingLeadBusinessDays ?? 3,
    ...(emails.length ? { notifyRecipientEmails: emails } : {}),
  };
}

export async function postNotifyRelay(
  summary: string,
  opts?: {
    subject?: string;
    monthKey?: string;
    pocketLeft?: number;
    digest?: SaveEmailDigestV1;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { enabled, url, husbandEmail, wifeEmail } = readNotifyRelayConfig();
  if (!enabled || !url || !serverAuthBearer()) return { ok: false, error: 'Notify relay not configured' };

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

  const digest = opts?.digest;
  const summaryOut =
    digest && digest.version === SAVE_EMAIL_DIGEST_VERSION
      ? digestPlainTextSummary(digest)
      : summary.trim();

  const id = ensureNotifyRelayHouseholdId();
  if (!id) return { ok: false, error: 'No household id' };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serverAuthBearer()}`,
    },
    body: JSON.stringify({
      summary: summaryOut,
      monthKey: opts?.monthKey ?? digest?.monthKey ?? currentMonthKey(),
      pocketLeft: opts?.pocketLeft ?? digest?.pocketLeft,
      digest: digest && digest.version === SAVE_EMAIL_DIGEST_VERSION ? digest : undefined,
      to: [husbandEmail, wifeEmail].filter(Boolean),
      id,
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
  const { enabled, url } = readNotifyRelayConfig();
  if (!enabled || !url || !serverAuthBearer()) return { ok: false, error: 'Notify relay not configured' };
  const base = url.endsWith('/v1/notify') ? url.replace(/\/v1\/notify$/, '') : url.replace(/\/$/, '');
  const snapUrl = `${base}/v1/snapshot`;
  const id = ensureNotifyRelayHouseholdId();
  if (!id) return { ok: false, error: 'No household id' };

  const res = await fetch(snapUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serverAuthBearer()}`,
    },
    body: JSON.stringify({ id, data }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: t || `HTTP ${res.status}` };
  }
  return { ok: true };
}
