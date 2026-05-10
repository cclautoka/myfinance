import { useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { currentMonthKey, formatCalendarMonthHeading, previousCalendarMonthKey } from '../data/defaults';
import { formatMoney, formatShortDate } from '../utils/format';
import { billsDueInFirstDaysOfMonth } from '../utils/monthOpening';
import { surplusSweepRoomRemaining } from '../utils/budgetSurplus';
import { billOccurrenceIsPaid } from '../utils/billsTimeline';

export function MonthCashflowOpeningModal({
  state,
  onConfirm,
}: {
  state: FinanceState;
  onConfirm: (savingsDirectedAway: number) => void;
}) {
  const mk = currentMonthKey();
  const prev = previousCalendarMonthKey(mk);
  const slack = useMemo(() => surplusSweepRoomRemaining(state, prev), [state, prev]);
  const earlyBills = useMemo(() => billsDueInFirstDaysOfMonth(state, mk, 10), [state, mk]);
  const [savingsDraft, setSavingsDraft] = useState('');

  const parsedSavings = (): number => {
    const n = Number.parseFloat(String(savingsDraft).trim().replace(/,/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  const savingsUsed = Math.min(parsedSavings(), slack);
  const carryPreview = Math.max(0, Math.round((slack - savingsUsed) * 100) / 100);

  return (
    <div
      className="scrollbar-app fixed inset-0 z-[240] overflow-y-auto bg-sage-950/75 p-4 backdrop-blur-md dark:bg-black/78"
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-opening-title"
    >
      <div className="mx-auto my-10 w-full max-w-lg rounded-[1.75rem] border-2 border-amber-600/65 bg-white p-6 shadow-2xl dark:border-amber-500/35 dark:bg-moss-elevated sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-200/90">
          Month not opened yet
        </p>
        <h2 id="month-opening-title" className="mt-2 font-display text-2xl font-bold text-sage-950 dark:text-moss-fg">
          Set {formatCalendarMonthHeading(mk)} before continuing
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
          We roll <strong className="text-sage-900 dark:text-moss-fg">only what wasn’t saved</strong> from last month into
          this month&apos;s cushion. Tell us how much you&apos;re moving to{' '}
          <strong className="text-sage-900 dark:text-moss-fg">savings first</strong> (early bills, payday timing, manual
          transfers). The remainder becomes <strong className="text-sage-900 dark:text-moss-fg">carry‑in</strong> for{' '}
          {formatCalendarMonthHeading(mk)} — you can tweak it later on the amber cashflow card.
        </p>

        <div className="mt-5 rounded-xl border border-sage-200/90 bg-sage-50/90 p-4 text-sm dark:border-moss-border dark:bg-moss-surface/70">
          <p className="font-semibold text-sage-900 dark:text-moss-fg">
            Unused slack after {formatCalendarMonthHeading(prev)} (workbook math)
          </p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-sage-900 dark:text-moss-fg">
            {formatMoney(slack)}
          </p>
          <p className="mt-2 text-[12px] leading-snug text-sage-700 dark:text-moss-muted">
            This is net incl. carry for that month, minus emergency sweeps you already tapped — not bank balance proof.
          </p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-700 dark:text-moss-muted">
            Payments due soon (first ~10 days of {formatCalendarMonthHeading(mk)})
          </p>
          {earlyBills.length === 0 ? (
            <p className="mt-2 text-sm italic text-sage-600 dark:text-moss-muted">No checklist lines dated that window.</p>
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
                        {paid ? ' · paid' : ''}
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

        <label className="mt-6 block text-sm font-semibold text-sage-900 dark:text-moss-fg">
          How much stays out of rollover (toward savings / early bills)?
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00 — use your judgement"
            value={savingsDraft}
            onChange={(e) => setSavingsDraft(e.target.value.replace(/[^0-9.,-]/g, ''))}
            className="mt-2 w-full rounded-xl border border-sage-400/80 bg-white px-4 py-3 text-sage-950 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
          />
        </label>
        <p className="mt-2 text-[12px] text-sage-700 dark:text-moss-muted">
          We cap at {formatMoney(slack)} — values above shrink to fit. Leaving $0 rolls the full slack into carry-in (if POSITIVE).
          {slack <= 0 && (
            <>
              {' '}
              <strong className="text-sage-900 dark:text-moss-fg">
                Slack is flat or negative —
              </strong>{' '}
              carry‑in stays $0 unless you bump it afterward on the cashflow card.
            </>
          )}
        </p>

        <div className="mt-5 rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 text-sm dark:border-teal-800/40 dark:bg-teal-950/20">
          <p className="font-semibold text-sage-900 dark:text-moss-fg">Roll into this month (typed carry‑in preview)</p>
          <p className="mt-2 font-display text-xl font-bold tabular-nums text-teal-950 dark:text-teal-100/95">
            {formatMoney(carryPreview)}
          </p>
          <p className="mt-2 text-[12px] text-sage-800 dark:text-moss-muted">
            = {formatMoney(slack)} slack −{' '}
            <span className="tabular-nums">{formatMoney(savingsUsed)}</span> staying out for savings.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary mt-6 w-full py-3 text-base font-bold"
          onClick={() => onConfirm(savingsUsed)}
        >
          Save & unlock {formatCalendarMonthHeading(mk)}
        </button>
      </div>
    </div>
  );
}
