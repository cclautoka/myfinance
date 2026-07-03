import { useEffect, useMemo, useState } from 'react';
import type { DebtAccount } from '../types/finance';
import { formatMoney } from '../utils/format';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';
import { ModalViewport } from './ui/ModalViewport';

function parseOwedDraft(s: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = s.trim();
  if (!t) return { ok: false, error: 'Enter how much is still owed.' };
  const n = Number.parseFloat(t.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { ok: false, error: 'Enter a valid number.' };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

function loanModalCopy(debt: DebtAccount): { title: string; intro: string; fieldLabel: string; placeholder: string } {
  if (debt.kind === 'loan') {
    return {
      title: 'Update balance',
      intro:
        'Enter the remaining balance from your bank app. Use a negative amount if you have overpaid (gone over). Snowball and debt-free update immediately.',
      fieldLabel: 'Remaining balance (bank app)',
      placeholder: 'e.g. 3988.40 or -50 if overpaid',
    };
  }
  return {
    title: 'Update balance',
    intro:
      'Enter what you still owe. Negative means you have overpaid. Mark fully paid off when nothing remains — the debt moves to achievements automatically.',
    fieldLabel: 'Amount still owed',
    placeholder: 'e.g. 281, 0, or -25 if overpaid',
  };
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
  const copy = debt ? loanModalCopy(debt) : null;

  if (!debt || !copy) return null;

  const canSave = parsed.ok;

  const submit = (markPaidOff = false) => {
    if (!canSave && !markPaidOff) return;
    onSave(debt.id, markPaidOff ? 0 : parsed.ok ? parsed.value : 0, { markPaidOff });
    onClose();
  };

  return (
    <ModalViewport open={open} onClose={onClose} ariaLabelledBy="update-debt-balance-title">
      <h2 id="update-debt-balance-title" className="font-display text-xl font-bold text-sage-950 dark:text-moss-fg">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm text-sage-700 dark:text-moss-subtle">{copy.intro}</p>
      <p className="mt-3 text-sm font-semibold text-sage-900 dark:text-moss-fg">{debt.name}</p>
      {debt.balanceUpdatedAt ? (
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">Last checked {debt.balanceUpdatedAt}</p>
      ) : null}
      <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
        Showing {formatMoney(currentBalance)} remaining (est.)
      </p>

      <label className="mt-4 block text-sm font-semibold text-sage-900 dark:text-moss-fg" htmlFor="debt-owed-input">
        {copy.fieldLabel}
        <input
          id="debt-owed-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder={copy.placeholder}
          value={owedDraft}
          aria-invalid={!parsed.ok}
          aria-describedby={!parsed.ok ? fieldErrorId('debt-owed') : undefined}
          onChange={(e) => setOwedDraft(e.target.value.replace(/[^0-9.,-]/g, ''))}
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
    </ModalViewport>
  );
}
