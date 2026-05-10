import type { FinanceState } from '../types/finance';
import { PAY_SCHEDULE_OPTIONS } from '../data/selectOptions';
import { nearestWeekdayISO } from '../utils/payScheduleAnchors';

type EarnerKey = 'husband' | 'wife';

/** Default weekday for “nearest …” shortcuts (Fri payroll vs Thu). */
const ANCHOR_WEEKDAY: Record<EarnerKey, number> = { husband: 5, wife: 4 };

export function ScheduledPayAutomationFields({
  earner,
  income,
  onIncome,
}: {
  earner: EarnerKey;
  income: FinanceState['income'];
  onIncome: (i: FinanceState['income']) => void;
}) {
  const patch = (p: Partial<FinanceState['income']>) => onIncome({ ...income, ...p });

  const schedule = earner === 'husband' ? income.husbandPaySchedule : income.wifePaySchedule;
  const rhythmLabel = PAY_SCHEDULE_OPTIONS.find((o) => o.value === schedule)?.label ?? schedule;

  const autoOn = earner === 'husband' ? Boolean(income.husbandPayAutoLog) : Boolean(income.wifePayAutoLog);
  const anchor =
    earner === 'husband' ? income.husbandPayAnchor ?? '' : income.wifeBiweeklyPayAnchor ?? '';

  const title = earner === 'husband' ? 'Husband · auto deposit log' : 'Wife · auto deposit log';
  const snapAnchorToTypicalWeekday = () =>
    patch(
      earner === 'husband'
        ? { husbandPayAnchor: nearestWeekdayISO(ANCHOR_WEEKDAY.husband) }
        : { wifeBiweeklyPayAnchor: nearestWeekdayISO(ANCHOR_WEEKDAY.wife) },
    );

  return (
    <div className="rounded-xl border border-sage-200/90 bg-sage-50/40 p-4 dark:border-moss-border dark:bg-moss-bg/40">
      <p className="text-[11px] font-bold uppercase tracking-wide text-sage-700 dark:text-moss-muted">{title}</p>
      <p className="mt-2 text-[11px] leading-snug text-sage-600 dark:text-moss-muted">
        Uses your <strong className="text-sage-800 dark:text-moss-subtle">{rhythmLabel}</strong>: weekly → +7 days; biweekly
        → +14; monthly → same calendar day (clamped). Nothing writes until{' '}
        <strong className="text-sage-800 dark:text-moss-subtle">12:00 local</strong> on pay day — no duplicate date + lane.
      </p>
      <label className="mt-3 flex cursor-pointer flex-wrap items-start gap-2 text-sm text-sage-900 dark:text-moss-fg">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-moss-accent"
          checked={autoOn}
          onChange={(e) => {
            const on = e.target.checked;
            if (earner === 'husband') {
              patch({
                husbandPayAutoLog: on,
                ...(on && !income.husbandPayAnchor
                  ? { husbandPayAnchor: nearestWeekdayISO(ANCHOR_WEEKDAY.husband) }
                  : {}),
              });
            } else {
              patch({
                wifePayAutoLog: on,
                ...(on && !income.wifeBiweeklyPayAnchor
                  ? { wifeBiweeklyPayAnchor: nearestWeekdayISO(ANCHOR_WEEKDAY.wife) }
                  : {}),
              });
            }
          }}
        />
        <span className="leading-snug">
          Auto-append to <strong className="text-sage-900 dark:text-moss-fg">Paycheque log</strong> on each payday starting from{' '}
          <strong className="text-sage-900 dark:text-moss-fg">{earner}</strong>.
        </span>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-sage-800 dark:text-moss-fg">
          Start date
          <input
            type="date"
            aria-label={`${earner} pay start anchor`}
            className="mt-1 block rounded-lg border border-sage-300 bg-white px-2 py-1 text-sm shadow-sm disabled:opacity-45 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            disabled={!autoOn}
            value={anchor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (earner === 'husband') patch({ husbandPayAnchor: v ? v : null });
              else patch({ wifeBiweeklyPayAnchor: v ? v : null });
            }}
          />
        </label>
        <button
          type="button"
          disabled={!autoOn}
          className="mt-6 rounded-lg border border-sage-300 bg-white px-2 py-1 text-[11px] font-semibold text-sage-900 disabled:pointer-events-none disabled:opacity-45 dark:border-moss-border dark:bg-moss-elevated dark:text-moss-fg"
          onClick={snapAnchorToTypicalWeekday}
        >
          {earner === 'husband' ? 'Nearest Fri' : 'Nearest Thu'}
        </button>
      </div>
    </div>
  );
}
