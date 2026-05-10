import { useEffect, useState } from 'react';
import type { BillsPaidTogglePayload, BillsTogglePayload } from '../utils/billsTimeline';
import { formatMoney } from '../utils/format';

function parseAmountDraft(draft: string, fallback: number): number {
  const t = draft.trim().replace(/,/g, '');
  if (t === '') return fallback;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : fallback;
}

export function BillPaymentMarkControls({
  occurrenceKey,
  toggleTarget,
  plannedAmount,
  isPaid,
  displayPaidAmount,
  onToggle,
  compact,
}: {
  occurrenceKey: string;
  toggleTarget: BillsTogglePayload;
  plannedAmount: number;
  isPaid: boolean;
  displayPaidAmount: number;
  onToggle: (payload: BillsPaidTogglePayload) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(() => String(plannedAmount));

  useEffect(() => {
    setDraft(String(plannedAmount));
  }, [occurrenceKey, plannedAmount]);

  const btn = compact ? 'btn-secondary btn-secondary-sm w-full' : 'btn-secondary w-full px-4 py-2';
  const inputCls =
    'min-w-0 w-full rounded-lg border border-sage-300/90 bg-white px-2 py-1.5 text-sm text-sage-900 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg';

  if (isPaid) {
    const delta = displayPaidAmount - plannedAmount;
    const planDiff = Math.abs(delta) > 0.005;
    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <p className="min-w-0 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
          Plan <span className="font-semibold text-sage-800 dark:text-moss-subtle">{formatMoney(plannedAmount)}</span>
          <span className="mx-1">·</span>
          Paid <span className="font-semibold text-sage-800 dark:text-moss-subtle">{formatMoney(displayPaidAmount)}</span>
          {planDiff && (
            <span className="ml-1 font-medium text-amber-800 dark:text-amber-300/90">
              ({delta >= 0 ? '+' : ''}
              {formatMoney(delta)})
            </span>
          )}
        </p>
        <button type="button" className={btn} onClick={() => onToggle(toggleTarget)}>
          Undo paid
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <label className="flex w-full min-w-0 flex-col gap-1">
        <span className="text-xs font-medium text-sage-700 dark:text-moss-muted">Actual paid</span>
        <input
          aria-label={`Actual paid amount for ${occurrenceKey}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,-]/g, ''))}
          className={inputCls}
        />
      </label>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const actualPaid = Math.max(0, parseAmountDraft(draft, plannedAmount));
          onToggle({ ...toggleTarget, actualPaid });
        }}
      >
        Mark handled
      </button>
    </div>
  );
}
