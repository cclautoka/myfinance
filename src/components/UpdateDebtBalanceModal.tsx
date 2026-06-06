import { useEffect, useMemo, useState } from 'react';
import type { DebtAccount } from '../types/finance';
import { formatMoney } from '../utils/format';
import { zLayers } from '../ui/zLayers';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';

function parseOwedDraft(s: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = s.trim();
  if (!t) return { ok: false, error: 'Enter how much is still owed.' };
  const n = Number.parseFloat(t.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { ok: false, error: 'Enter a valid number.' };
  if (n < 0) return { ok: false, error: 'Owed cannot be negative.' };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function UpdateDebtBalanceModal({
  debt,
  currentBalance,
  open,
  onClose,
  onSave,
}: {
  debt: DebtAccount | null;
  /** Effective balance shown in the table (may differ from stored balance for schedule-based HP). */
  currentBalance: number;
  open: boolean;
  onClose: () => void;
  onSave: (debtId: string, balance: number, options?: { markPaidOff?: boolean }) => void;
}) {
  const [owedDraft, setOwedDraft] = useState('');

  useEffect(() => {
    if (open && debt) {
      setOwedDraft(currentBalance > 0 ? String(currentBalance) : debt.balance > 0 ? String(debt.balance) : '0');
    }
  }, [open, debt, currentBalance]);

  const parsed = useMemo(() => parseOwedDraft(owedDraft), [owedDraft]);

  if (!open || !debt) return null;

  const canSave = parsed.ok;

  const submit = (markPaidOff = false) => {
    if (!canSave && !markPaidOff) return;
    onSave(debt.id, markPaidOff ? 0 : parsed.ok ? parsed.value : 0, { markPaidOff });
    onClose();
  };

  return (
    <div
      className="bill-confirm-backdrop-in fixed inset-0 flex items-end justify-center bg-sage-950/70 p-4 backdrop-blur-sm dark:bg-black/75 sm:items-center"
      style={{ zIndex: zLayers.modal }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-debt-balance-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bill-confirm-panel-in w-full max-w-md rounded-2xl border border-sage-200/90 bg-white p-6 shadow-2xl dark:border-moss-border dark:bg-moss-elevated">
        <h2 id="update-debt-balance-title" className="font-display text-xl font-bold text-sage-950 dark:text-moss-fg">
          Update balance
        </h2>
        <p className="mt-2 text-sm text-sage-700 dark:text-moss-subtle">
          Override what you still owe — snowball and debt-free projections update immediately. Mark fully paid off to
          clear remaining calendar lines too.
        </p>
        <p className="mt-3 text-sm font-semibold text-sage-900 dark:text-moss-fg">{debt.name}</p>
        {debt.balanceUpdatedAt ? (
          <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">Last updated {debt.balanceUpdatedAt}</p>
        ) : null}
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
          Showing {formatMoney(currentBalance)} remaining (est.)
        </p>

        <label className="mt-4 block text-sm font-semibold text-sage-900 dark:text-moss-fg" htmlFor="debt-owed-input">
          Amount still owed
          <input
            id="debt-owed-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="e.g. 281 or 0"
            value={owedDraft}
            aria-invalid={!parsed.ok}
            aria-describedby={!parsed.ok ? fieldErrorId('debt-owed') : undefined}
            onChange={(e) => setOwedDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
            className="mt-2 w-full rounded-xl border border-sage-400/80 bg-white px-4 py-3 text-sage-950 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
          />
          <FieldError id={fieldErrorId('debt-owed')} message={!parsed.ok ? parsed.error : null} />
        </label>

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className="btn-primary w-full py-2.5" disabled={!canSave} onClick={() => submit(false)}>
            Save balance
          </button>
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-emerald-900 dark:text-emerald-200"
            onClick={() => submit(true)}
          >
            Mark fully paid off
          </button>
          <button type="button" className="btn-secondary py-2.5" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
