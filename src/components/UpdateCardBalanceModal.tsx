import { useEffect, useMemo, useState } from 'react';
import type { DebtAccount } from '../types/finance';
import { cardAvailableFromOwed, cardOwedFromAvailable } from '../utils/cardCredit';
import { formatMoney } from '../utils/format';
import { FieldError } from './ui/FieldError';
import { fieldErrorId } from './ui/fieldErrorId';
import { ModalViewport } from './ui/ModalViewport';

function parseAmountDraft(s: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = s.trim();
  if (!t) return { ok: false, error: 'Enter the amount your bank app shows as available.' };
  const n = Number.parseFloat(t.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { ok: false, error: 'Enter a valid number.' };
  if (n < 0) return { ok: false, error: 'Available cannot be negative.' };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function UpdateCardBalanceModal({
  debt,
  open,
  onClose,
  onSave,
  title = 'Update balance',
  intro = 'Enter the available balance from your bank app — we work out how much is owed from your credit limit.',
}: {
  debt: DebtAccount | null;
  open: boolean;
  onClose: () => void;
  onSave: (debtId: string, availableCredit: number, creditLimit?: number) => void;
  title?: string;
  intro?: string;
}) {
  const [availableDraft, setAvailableDraft] = useState('');
  const [limitDraft, setLimitDraft] = useState('');

  useEffect(() => {
    if (open && debt) {
      const avail = cardAvailableFromOwed(debt);
      setAvailableDraft(avail !== null ? String(avail) : '');
      setLimitDraft(debt.creditLimit && debt.creditLimit > 0 ? String(debt.creditLimit) : '');
    }
  }, [open, debt]);

  const parsedAvailable = useMemo(() => parseAmountDraft(availableDraft), [availableDraft]);
  const parsedLimit = useMemo(() => {
    const t = limitDraft.trim();
    if (!t) return { ok: false as const, error: 'Credit limit is required to convert available → owed.' };
    const n = Number.parseFloat(t.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return { ok: false as const, error: 'Enter a valid credit limit.' };
    return { ok: true as const, value: Math.round(n * 100) / 100 };
  }, [limitDraft]);

  const owedPreview =
    parsedAvailable.ok && parsedLimit.ok
      ? cardOwedFromAvailable(parsedLimit.value, parsedAvailable.value)
      : null;

  if (!debt) return null;

  const canSave = parsedAvailable.ok && parsedLimit.ok;

  const submit = () => {
    if (!canSave) return;
    onSave(debt.id, parsedAvailable.value, parsedLimit.value);
    onClose();
  };

  return (
    <ModalViewport open={open} onClose={onClose} ariaLabelledBy="update-card-balance-title">
      <h2 id="update-card-balance-title" className="font-display text-xl font-bold text-sage-950 dark:text-moss-fg">
        {title}
      </h2>
      <p className="mt-2 text-sm text-sage-700 dark:text-moss-subtle">{intro}</p>
      <p className="mt-3 text-sm font-semibold text-sage-900 dark:text-moss-fg">{debt.name}</p>
      {debt.balanceUpdatedAt ? (
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">Last checked {debt.balanceUpdatedAt}</p>
      ) : null}
      {debt.balance > 0 && debt.creditLimit ? (
        <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">
          Stored: {formatMoney(cardAvailableFromOwed(debt) ?? 0)} available · {formatMoney(debt.balance)} owed
        </p>
      ) : null}

      <label className="mt-4 block text-sm font-semibold text-sage-900 dark:text-moss-fg" htmlFor="card-available-input">
        Available to use (bank app)
        <input
          id="card-available-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder="e.g. 0.51 or 34.44"
          value={availableDraft}
          aria-invalid={!parsedAvailable.ok}
          aria-describedby={!parsedAvailable.ok ? fieldErrorId('card-available') : undefined}
          onChange={(e) => setAvailableDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
          className="mt-2 w-full rounded-xl border border-sage-400/80 bg-white px-4 py-3 text-sage-950 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
        />
        <FieldError
          id={fieldErrorId('card-available')}
          message={!parsedAvailable.ok ? parsedAvailable.error : null}
        />
      </label>

      <label className="mt-4 block text-sm font-semibold text-sage-900 dark:text-moss-fg" htmlFor="card-limit-input">
        Credit limit
        <input
          id="card-limit-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 2500"
          value={limitDraft}
          aria-invalid={!parsedLimit.ok}
          aria-describedby={!parsedLimit.ok ? fieldErrorId('card-limit') : undefined}
          onChange={(e) => setLimitDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
          className="mt-2 w-full rounded-xl border border-sage-400/80 bg-white px-4 py-3 text-sage-950 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
        />
        <FieldError id={fieldErrorId('card-limit')} message={!parsedLimit.ok ? parsedLimit.error : null} />
      </label>

      {owedPreview !== null ? (
        <p className="mt-3 rounded-lg border border-teal-200/70 bg-teal-50/60 px-3 py-2 text-sm text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/25 dark:text-teal-100/90">
          → About <strong>{formatMoney(owedPreview)}</strong> owed (limit − available)
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn-primary flex-1 py-2.5" disabled={!canSave} onClick={submit}>
          Save
        </button>
        <button type="button" className="btn-secondary py-2.5" onClick={onClose}>
          Cancel
        </button>
      </div>
    </ModalViewport>
  );
}
