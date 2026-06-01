import { useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { currentMonthKey, formatCalendarMonthHeading, previousCalendarMonthKey } from '../data/defaults';
import { formatMoney, formatShortDate } from '../utils/format';
import { monthOpening as monthOpeningCopy } from '../copy/monthOpening';
import { billsDueInFirstDaysOfMonth } from '../utils/monthOpening';
import {
  monthPocketSlackForRollover,
  totalMonthOpeningAllocation,
  type MonthOpeningAllocationInput,
} from '../utils/budgetSurplus';
import { billOccurrenceIsPaid } from '../utils/billsTimeline';
import { zLayers } from '../ui/zLayers';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';
import { FieldHelp } from './ui/FieldHelp';

function parseAmountDraft(s: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = s.trim();
  if (!t) return { ok: true, value: 0 };
  const n = Number.parseFloat(t.replace(/,/g, ''));
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Enter a valid number (e.g. 500 or 0.5), or leave blank for $0.' };
  }
  if (n < 0) return { ok: false, error: 'Amount cannot be negative.' };
  return { ok: true, value: n };
}

const EMERGENCY_FIELD = '__emergency__';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function MonthCashflowOpeningModal({
  state,
  onConfirm,
  onStartTourAfterUnlock,
}: {
  state: FinanceState;
  onConfirm: (allocations: MonthOpeningAllocationInput) => void;
  /** Clears onboarding dismiss flag and bumps parent tour key after the month is opened. */
  onStartTourAfterUnlock?: () => void;
}) {
  const mk = currentMonthKey();
  const prev = previousCalendarMonthKey(mk);
  const mo = monthOpeningCopy;
  const monthHeading = formatCalendarMonthHeading(mk);
  const prevHeading = formatCalendarMonthHeading(prev);
  const slack = useMemo(() => monthPocketSlackForRollover(state, prev), [state, prev]);
  const earlyBills = useMemo(() => billsDueInFirstDaysOfMonth(state, mk, 10), [state, mk]);
  const goalRows = state.savingsGoals ?? [];

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const parsedByField = useMemo(() => {
    const out: Record<string, { ok: true; value: number } | { ok: false; error: string }> = {};
    out[EMERGENCY_FIELD] = parseAmountDraft(drafts[EMERGENCY_FIELD] ?? '');
    for (const g of goalRows) {
      out[g.id] = parseAmountDraft(drafts[g.id] ?? '');
    }
    return out;
  }, [drafts, goalRows]);

  const allParsedOk = Object.values(parsedByField).every((p) => p.ok);

  const allocationInput = useMemo((): MonthOpeningAllocationInput => {
    const emergencyParsed = parsedByField[EMERGENCY_FIELD];
    const emergency = emergencyParsed?.ok ? emergencyParsed.value : 0;
    const goals: Record<string, number> = {};
    for (const g of goalRows) {
      const p = parsedByField[g.id];
      if (p?.ok && p.value > 0) goals[g.id] = p.value;
    }
    return { emergency, goals };
  }, [parsedByField, goalRows]);

  const rawTotal = totalMonthOpeningAllocation(allocationInput);
  const allocatedTotal = Math.min(rawTotal, slack);
  const carryPreview = Math.max(0, Math.round((slack - allocatedTotal) * 100) / 100);

  const cappedAllocation = useMemo((): MonthOpeningAllocationInput => {
    if (rawTotal <= slack || rawTotal <= 0) return allocationInput;
    let remaining = slack;
    const emergency = Math.min(Math.max(0, allocationInput.emergency ?? 0), remaining);
    remaining = round2(remaining - emergency);
    const goals: Record<string, number> = {};
    for (const g of goalRows) {
      const want = allocationInput.goals?.[g.id] ?? 0;
      const take = Math.min(want, remaining);
      if (take > 0) goals[g.id] = take;
      remaining = round2(remaining - take);
    }
    return { emergency, goals };
  }, [allocationInput, goalRows, rawTotal, slack]);

  const setDraft = (id: string, value: string) => {
    setDrafts((d) => ({ ...d, [id]: value.replace(/[^0-9.,]/g, '') }));
  };

  const submit = () => {
    if (!allParsedOk) return;
    onConfirm(cappedAllocation);
  };

  return (
    <div
      className="bill-confirm-backdrop-in scrollbar-app fixed inset-0 overflow-y-auto bg-sage-950/75 p-4 backdrop-blur-md dark:bg-black/78"
      style={{ zIndex: zLayers.monthGate }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-opening-title"
    >
      <div className="bill-confirm-panel-in mx-auto my-10 w-full max-w-lg rounded-[1.75rem] border-2 border-amber-600/65 bg-white p-6 shadow-2xl dark:border-amber-500/35 dark:bg-moss-elevated sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-200/90">
          {mo.gateLabel}
        </p>
        <h2 id="month-opening-title" className="mt-2 font-display text-2xl font-bold text-sage-950 dark:text-moss-fg">
          {mo.title(monthHeading)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
          {mo.intro(prevHeading, monthHeading)}
        </p>
        <p className="mt-3 rounded-xl border border-teal-200/70 bg-teal-50/60 px-3 py-2 text-[13px] leading-snug text-sage-800 dark:border-teal-900/40 dark:bg-teal-950/25 dark:text-teal-100/90">
          {mo.tourNote}
        </p>

        <div className="mt-5 rounded-xl border border-sage-200/90 bg-sage-50/90 p-4 text-sm dark:border-moss-border dark:bg-moss-surface/70">
          <p className="font-semibold text-sage-900 dark:text-moss-fg">{mo.leftoverTitle(prevHeading)}</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-sage-900 dark:text-moss-fg">
            {formatMoney(slack)}
          </p>
          <p className="mt-2 text-[12px] leading-snug text-sage-700 dark:text-moss-muted">{mo.leftoverDetail}</p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
            {mo.dueSoonTitle(monthHeading)}
          </p>
          {earlyBills.length === 0 ? (
            <p className="mt-2 text-sm italic text-sage-600 dark:text-moss-muted">{mo.dueSoonEmpty}</p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-[13px]">
              {earlyBills.map((b) => {
                const paid = billOccurrenceIsPaid(state, b);
                return (
                  <li
                    key={b.id}
                    className={`flex flex-wrap justify-between gap-2 border-b border-sage-100/80 py-1.5 dark:border-moss-border/60 ${paid ? 'opacity-70' : ''}`}
                  >
                    <span className="min-w-0 break-words text-sage-800 dark:text-moss-subtle">
                      {b.name}{' '}
                      <span className="text-sage-600 dark:text-moss-muted">
                        · {formatShortDate(b.due)}
                        {paid ? mo.dueSoonPaidSuffix : ''}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium text-sage-900 dark:text-moss-fg">
                      {formatMoney(b.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
            {mo.savingsSectionTitle}
          </p>

          <label className="block text-sm font-semibold text-sage-900 dark:text-moss-fg" htmlFor="month-opening-emergency">
            {mo.emergencyFieldLabel}
            <FieldHelp label="Emergency pool">{mo.emergencyFieldHelp}</FieldHelp>
            <input
              id="month-opening-emergency"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={mo.emergencyPlaceholder}
              value={drafts[EMERGENCY_FIELD] ?? ''}
              aria-invalid={parsedByField[EMERGENCY_FIELD] && !parsedByField[EMERGENCY_FIELD].ok}
              aria-describedby={
                parsedByField[EMERGENCY_FIELD] && !parsedByField[EMERGENCY_FIELD].ok
                  ? fieldErrorId('month-emergency')
                  : undefined
              }
              onChange={(e) => setDraft(EMERGENCY_FIELD, e.target.value)}
              className="mt-2 w-full rounded-xl border border-sage-400/80 bg-white px-4 py-3 text-sage-950 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
            />
            <FieldError
              id={fieldErrorId('month-emergency')}
              message={
                parsedByField[EMERGENCY_FIELD] && !parsedByField[EMERGENCY_FIELD].ok
                  ? parsedByField[EMERGENCY_FIELD].error
                  : null
              }
            />
          </label>

          {goalRows.map((g) => {
            const p = parsedByField[g.id];
            return (
              <label
                key={g.id}
                className="block text-sm font-semibold text-sage-900 dark:text-moss-fg"
                htmlFor={`month-opening-goal-${g.id}`}
              >
                {g.name}
                <input
                  id={`month-opening-goal-${g.id}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={mo.goalPlaceholder}
                  value={drafts[g.id] ?? ''}
                  aria-invalid={p && !p.ok}
                  aria-describedby={p && !p.ok ? fieldErrorId(`month-goal-${g.id}`) : undefined}
                  onChange={(e) => setDraft(g.id, e.target.value)}
                  className="mt-2 w-full rounded-xl border border-sage-400/80 bg-white px-4 py-3 text-sage-950 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                />
                <FieldError id={fieldErrorId(`month-goal-${g.id}`)} message={p && !p.ok ? p.error : null} />
              </label>
            );
          })}
        </div>

        <p className="mt-3 text-[12px] text-sage-700 dark:text-moss-muted">
          {mo.capNote(formatMoney(slack))}
          {slack <= 0 && (
            <>
              {' '}
              <strong className="text-sage-900 dark:text-moss-fg">{mo.slackFlatNote}</strong>
            </>
          )}
        </p>

        <div className="mt-5 rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 text-sm dark:border-teal-800/40 dark:bg-teal-950/20">
          <p className="font-semibold text-sage-900 dark:text-moss-fg">{mo.carryPreviewTitle}</p>
          <p className="mt-2 font-display text-xl font-bold tabular-nums text-teal-950 dark:text-teal-100/95">
            {formatMoney(carryPreview)}
          </p>
          <p className="mt-2 text-[12px] text-sage-800 dark:text-moss-muted">
            {mo.carryPreviewFormula(formatMoney(slack), formatMoney(allocatedTotal))}
          </p>
        </div>

        <button
          type="button"
          className="btn-primary mt-6 w-full py-3 text-base font-bold"
          disabled={!allParsedOk}
          onClick={submit}
        >
          {mo.saveUnlock(monthHeading)}
        </button>
        {onStartTourAfterUnlock ? (
          <button
            type="button"
            className="btn-secondary mt-3 w-full py-2.5 text-sm font-bold"
            disabled={!allParsedOk}
            onClick={() => {
              submit();
              onStartTourAfterUnlock();
            }}
          >
            {mo.saveUnlockTour}
          </button>
        ) : null}
      </div>
    </div>
  );
}
