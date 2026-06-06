import { useMemo } from 'react';
import type { DebtAccount, FinanceState } from '../types/finance';
import { debtPaymentHistory } from '../utils/paymentHistory';
import { formatMoney } from '../utils/format';
import { ModalViewport } from './ui/ModalViewport';

function formatMarkedAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function DebtPaymentHistoryModal({
  debt,
  state,
  open,
  onClose,
}: {
  debt: DebtAccount | null;
  state: FinanceState;
  open: boolean;
  onClose: () => void;
}) {
  const entries = useMemo(
    () => (debt ? debtPaymentHistory(state, debt) : []),
    [debt, state],
  );
  const totalPaid = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);

  if (!debt) return null;

  return (
    <ModalViewport open={open} onClose={onClose} ariaLabelledBy="debt-history-title">
      <h2 id="debt-history-title" className="font-display text-xl font-bold text-sage-950 dark:text-moss-fg">
        Payment history
      </h2>
      <p className="mt-1 text-sm font-semibold text-sage-900 dark:text-moss-fg">{debt.name}</p>
      <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
        {entries.length} payment{entries.length === 1 ? '' : 's'} · {formatMoney(totalPaid)} total marked paid
      </p>

      <div className="mt-4">
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sage-300/80 px-4 py-6 text-center text-sm text-sage-600 dark:border-moss-border dark:text-moss-muted">
            No calendar payments recorded yet. Mark installments on the Bill calendar or tap a row in the debt table
            to log payments.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.paymentKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sage-200/70 bg-sage-50/50 px-3 py-2.5 dark:border-moss-border dark:bg-moss-bg/40"
              >
                <div>
                  <p className="text-sm font-medium text-sage-900 dark:text-moss-fg">Due {e.dueDate}</p>
                  <p className="text-xs text-sage-600 dark:text-moss-muted">
                    {e.paidBy}
                    {e.markedAt ? ` · marked ${formatMarkedAt(e.markedAt)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-sage-900 dark:text-moss-fg">
                  {formatMoney(e.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="btn-secondary mt-4 w-full py-2.5" onClick={onClose}>
        Close
      </button>
    </ModalViewport>
  );
}
