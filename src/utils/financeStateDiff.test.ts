import { describe, expect, it } from 'vitest';
import { defaultFinanceState } from '../data/defaults';
import { computeFinanceStateDiff } from './financeStateDiff';

describe('computeFinanceStateDiff', () => {
  it('detects income field changes', () => {
    const from = defaultFinanceState();
    const to = {
      ...from,
      income: { ...from.income, husbandMonthly: from.income.husbandMonthly + 100 },
    };
    const { sections, truncated } = computeFinanceStateDiff(from, to);
    expect(truncated).toBe(false);
    const flat = sections.flatMap((s) => s.items ?? []);
    expect(flat.some((i) => i.title.includes('husbandMonthly'))).toBe(true);
  });

  it('detects bill paid toggle', () => {
    const from = defaultFinanceState();
    const e = from.essentials[0];
    if (!e) return;
    const to = {
      ...from,
      billsPaid: {
        ...from.billsPaid,
        [e.id]: ['2026-05'],
      },
    };
    const { sections } = computeFinanceStateDiff(from, to);
    const flat = sections.flatMap((s) => s.items ?? []);
    expect(flat.some((i) => i.title === 'Bill checkmarks')).toBe(true);
  });

  it('returns neutral message when states are identical', () => {
    const s = defaultFinanceState();
    const { sections } = computeFinanceStateDiff(s, s);
    const w = sections.find((x) => x.heading === 'What changed');
    expect(w?.body).toMatch(/No field-level differences/i);
  });
});
