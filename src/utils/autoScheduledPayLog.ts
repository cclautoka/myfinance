import type { FinanceState, IncomeLogEntry, PaySchedule } from '../types/finance';
import { estimatedPaychequeFromMonthly } from './expectedPaycheque';
import { localNoonOnOrBefore } from './payScheduleAnchors';

const round2 = (n: number) => Math.round(n * 100) / 100;

const newId = () => Math.random().toString(36).slice(2, 12);

function addDaysLocal(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Advance one payday from iso following Household pay rhythm. */
export function advancePayAnchor(iso: string, schedule: PaySchedule): string {
  switch (schedule) {
    case 'weekly':
      return addDaysLocal(iso, 7);
    case 'biweekly':
      return addDaysLocal(iso, 14);
    case 'monthly':
    default: {
      const [yS, mos, dom] = iso.split('-').map(Number);
      let y = yS;
      let mZero = mos - 1;
      mZero += 1;
      if (mZero > 11) {
        mZero = 0;
        y++;
      }
      const lastDom = new Date(y, mZero + 1, 0).getDate();
      const d = Math.min(dom, lastDom);
      const mm = String(mZero + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }
}

function autoLabel(earner: 'husband' | 'wife', schedule: PaySchedule): string {
  const who = earner === 'husband' ? 'Husband' : 'Wife';
  const cad =
    schedule === 'weekly'
      ? 'weekly'
      : schedule === 'biweekly'
        ? 'biweekly'
        : 'monthly';
  return `${who} pay (${cad} · auto)`;
}

function additionsForEarner(
  state: FinanceState,
  ref: Date,
  earner: 'husband' | 'wife',
): IncomeLogEntry[] {
  const inc = state.income;
  const autoOn = earner === 'husband' ? inc.husbandPayAutoLog : inc.wifePayAutoLog;
  if (!autoOn) return [];
  const anchorRaw =
    (earner === 'husband'
      ? (inc.husbandPayAnchor ?? '')
      : (inc.wifeBiweeklyPayAnchor ?? '')
    ).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorRaw)) return [];

  const schedule =
    earner === 'husband' ? inc.husbandPaySchedule ?? 'weekly' : inc.wifePaySchedule ?? 'biweekly';

  const typical = earner === 'husband' ? inc.husbandTypicalPerPay : inc.wifeTypicalPerPay;
  const monthly = earner === 'husband' ? inc.husbandMonthly : inc.wifeMonthly;
  const amount =
    typical > 0 ? round2(typical) : round2(estimatedPaychequeFromMonthly(monthly, schedule));
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const taken = new Set(
    state.incomeLog.filter((e) => e.earner === earner).map((e) => e.date.slice(0, 10)),
  );

  const out: IncomeLogEntry[] = [];
  let payIso = anchorRaw;

  for (let step = 0; step < 520; step++) {
    if (!localNoonOnOrBefore(payIso, ref)) break;
    if (!taken.has(payIso)) {
      out.push({
        id: newId(),
        date: payIso,
        amount,
        earner,
        label: autoLabel(earner, schedule),
      });
      taken.add(payIso);
    }
    payIso = advancePayAnchor(payIso, schedule);
  }
  return out;
}

/**
 * Inserts missing paycheque rows for Husband / Wife when their auto prefs are on, anchor + Household rhythm apply,
 * and local time is past noon on each payday. Idempotent per date + earner.
 */
export function applyAutoScheduledPayLogs(state: FinanceState, ref = new Date()): FinanceState {
  const hAdds = additionsForEarner(state, ref, 'husband');
  const wAdds = additionsForEarner(state, ref, 'wife');
  const adds = [...hAdds, ...wAdds];
  if (adds.length === 0) return state;
  const sortedDesc = adds.sort((a, b) => b.date.localeCompare(a.date));
  return { ...state, incomeLog: [...sortedDesc, ...state.incomeLog] };
}
