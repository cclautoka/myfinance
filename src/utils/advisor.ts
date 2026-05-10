import type { FinanceState } from '../types/finance';
import { allocationBreakdown } from './allocation';
import {
  availableForBillsHint,
  billOccurrenceIsPaid,
  billVisualStatus,
  buildTimeline,
  upcomingDeductionsTotal,
} from './billsTimeline';
import { totalDebtRemaining } from './calculations';
import { estimatedDebtFreeMonths } from './debtFree';
import { endingSoonRedirect, snowballOrder } from './snowball';
import { computeSafeSpend } from './safeSpend';
import { formatMoney } from './format';

export type AdvisorTone = 'calm' | 'celebrate' | 'heads-up';

export interface AdvisorMessage {
  id: string;
  tone: AdvisorTone;
  title: string;
  body: string;
}

const milestoneFund = (state: FinanceState): number | null => {
  if (state.emergencyFund >= 1000 && state.emergencyFund < 1005) return 1000;
  if (state.emergencyFund >= state.threeMonthFundTarget * 0.99) return state.threeMonthFundTarget;
  return null;
};

export const buildAdvisorMessages = (state: FinanceState, ref = new Date()): AdvisorMessage[] => {
  const messages: AdvisorMessage[] = [];
  const debtTotal = totalDebtRemaining(state.debts, ref);
  const { remainder, pctSum, savings } = allocationBreakdown(state);
  const safe = computeSafeSpend(state, 14, ref);
  const months = estimatedDebtFreeMonths(state, ref);

  if (pctSum < 99 || pctSum > 101) {
    messages.push({
      id: 'pct-sum',
      tone: 'heads-up',
      title: 'Plan check‑in',
      body: `Your allocation percentages add up to ${Math.round(pctSum)}%. When they total 100%, it is easier to trust the plan end‑to‑end.`,
    });
  }

  if (remainder < 0) {
    messages.push({
      id: 'remainder',
      tone: 'heads-up',
      title: 'Breathing room',
      body: `Your kind targets currently ask for about ${formatMoney(-remainder)} more than income this month. A small tweak to one bucket is enough — progress still counts.`,
    });
  }

  const ending = endingSoonRedirect(state.debts, ref);
  if (ending) {
    messages.push({
      id: 'redirect',
      tone: 'calm',
      title: 'Snowball opportunity',
      body: `${ending.ending.name} is nearing the finish line. When it ends, consider flowing ${formatMoney(ending.redirectAmount)} toward ${ending.target.name} — you are already building this habit together.`,
    });
  }

  const upcoming = upcomingDeductionsTotal(state, 10, ref);
  const cushion = availableForBillsHint(state);
  if (upcoming > cushion * 0.85 && upcoming > 0) {
    messages.push({
      id: 'upcoming-heavy',
      tone: 'heads-up',
      title: 'Upcoming cash rhythm',
      body: `About ${formatMoney(upcoming)} is lined up in the next ten days. You are not behind — this is a gentle nudge to peek at the timeline together.`,
    });
  }

  const tl2 = buildTimeline(state, 2, ref);
  const overdueUnpaid = tl2.filter(
    (b) => !billOccurrenceIsPaid(state, b) && billVisualStatus(state, b, ref) === 'overdue',
  );
  if (overdueUnpaid.length > 0) {
    messages.push({
      id: 'overdue-bills',
      tone: 'heads-up',
      title: 'Payments past due',
      body: `${overdueUnpaid.length} timeline line${overdueUnpaid.length === 1 ? '' : 's'} ${overdueUnpaid.length === 1 ? 'is' : 'are'} overdue past any delay you set. Open the bill calendar and mark handled or revisit dates.`,
    });
  }

  const firstUnpaid = tl2.find((b) => !billOccurrenceIsPaid(state, b));
  if (firstUnpaid && overdueUnpaid.length === 0) {
    messages.push({
      id: 'next-bill',
      tone: 'calm',
      title: 'Next friendly date',
      body: `${firstUnpaid.name} (${formatMoney(firstUnpaid.amount)}) is next on the calendar. You have planned for teamwork moments like this.`,
    });
  }

  if (savings > 0) {
    messages.push({
      id: 'savings',
      tone: 'calm',
      title: 'Savings pulse',
      body: `Your plan sets aside about ${formatMoney(savings)} this month. Small, steady deposits quietly rewrite the story.`,
    });
  }

  if (months !== null && months > 0 && debtTotal > 0) {
    messages.push({
      id: 'debt-progress',
      tone: 'calm',
      title: 'Debt‑free horizon',
      body: `If payments stay near today’s level, a soft estimate is roughly ${months} month${months === 1 ? '' : 's'} — a compass, not a deadline.`,
    });
  }

  messages.push({
    id: 'safe-spend',
    tone: 'calm',
    title: 'Safe‑to‑spend hint',
    body: `A gentle weekly spending guide is about ${formatMoney(safe.weeklyHint)} — flexible, not a test.`,
  });

  const ms = milestoneFund(state);
  if (ms) {
    messages.push({
      id: 'mile-fund',
      tone: 'celebrate',
      title: 'Milestone',
      body:
        ms === 1000
          ? 'You crossed your first $1,000 cushion — that is real stability you built side by side.'
          : 'Your emergency fund reached your three‑month target. That is extraordinary teamwork.',
    });
  }

  const order = snowballOrder(state.debts, ref);
  const first = order.find((r) => r.snowballOrder === 1);
  if (first && first.effectiveBalance > 0 && first.effectiveBalance < first.debt.monthlyPayment * 2) {
    messages.push({
      id: 'almost',
      tone: 'celebrate',
      title: 'Almost there',
      body: `${first.debt.name} is within reach. Finish it on your timing — then let the snowball carry the win forward.`,
    });
  }

  if (debtTotal <= 0) {
    messages.push({
      id: 'debt-free',
      tone: 'celebrate',
      title: 'Debt‑free zone',
      body: 'No remaining balances tracked here. Take a breath together — you earned this screen.',
    });
  }

  const dedupe = new Map<string, AdvisorMessage>();
  for (const m of messages) dedupe.set(m.id, m);
  return [...dedupe.values()].slice(0, 8);
};
