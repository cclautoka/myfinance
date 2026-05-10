import type { FinanceState, IncomeEarner, IncomeLogEntry, PaySchedule } from '../types/finance';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** How we convert “monthly plan” into one typical deposit (same weekly = 4 weeks/month as the rest of the app). */
export const estimatedPaychequeFromMonthly = (monthly: number, schedule: PaySchedule): number => {
  switch (schedule) {
    case 'weekly':
      return monthly / 4;
    case 'biweekly':
      return (monthly * 12) / 26;
    case 'monthly':
    default:
      return monthly;
  }
};

export function expectedPaychequeForLoggedEarner(state: FinanceState, earner: IncomeEarner): number {
  const inc = state.income;
  if (earner === 'joint') return 0;
  if (earner === 'husband') {
    if (inc.husbandTypicalPerPay > 0) return round2(inc.husbandTypicalPerPay);
    return round2(
      estimatedPaychequeFromMonthly(
        inc.husbandMonthly,
        inc.husbandPaySchedule ?? 'weekly',
      ),
    );
  }
  if (earner === 'wife') {
    if (inc.wifeTypicalPerPay > 0) return round2(inc.wifeTypicalPerPay);
    return round2(
      estimatedPaychequeFromMonthly(
        inc.wifeMonthly,
        inc.wifePaySchedule ?? 'biweekly',
      ),
    );
  }
  return 0;
}

/** Portion of one logged deposit above the Household baseline (not double-counted elsewhere). */
export function overtimeOnIncomeLogRow(state: FinanceState, e: IncomeLogEntry): number {
  if (e.earner === 'joint') return 0;
  const base = expectedPaychequeForLoggedEarner(state, e.earner);
  if (base <= 0) return 0;
  return round2(Math.max(0, e.amount - base));
}

/** Sum of estimated OT across paycheque rows for that calendar month. */
export function incomeLogOvertimeMonthTotal(state: FinanceState, monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  let s = 0;
  for (const e of state.incomeLog) {
    const d = new Date(e.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    s += overtimeOnIncomeLogRow(state, e);
  }
  return round2(s);
}

/** OT / above-baseline pay by earner for a calendar month (joint rows contribute 0 here). */
export function incomeLogOvertimeByEarner(
  state: FinanceState,
  monthKey: string,
): { husband: number; wife: number } {
  const [y, m] = monthKey.split('-').map(Number);
  let husband = 0;
  let wife = 0;
  for (const e of state.incomeLog) {
    const d = new Date(e.date);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    const o = overtimeOnIncomeLogRow(state, e);
    if (e.earner === 'husband') husband += o;
    else if (e.earner === 'wife') wife += o;
  }
  return { husband: round2(husband), wife: round2(wife) };
}
