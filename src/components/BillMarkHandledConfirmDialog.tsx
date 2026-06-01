import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { bills as billsCopy } from '../copy/bills';
import { formatMoney, formatShortDate } from '../utils/format';
import { zLayers } from '../ui/zLayers';

const EXIT_MS = 280;

export function BillMarkHandledConfirmDialog({
  open,
  onClose,
  onConfirm,
  billName,
  due,
  plannedAmount,
  actualPaid,
  attributedAsLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  billName: string;
  due: Date;
  plannedAmount: number;
  actualPaid: number;
  attributedAsLabel: string;
}) {
  const titleId = useId();
  const descId = useId();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const c = billsCopy.confirmDialog;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, visible]);

  const dismiss = useCallback(
    (action: 'cancel' | 'confirm') => {
      setVisible(false);
      window.setTimeout(() => {
        if (action === 'confirm') onConfirm();
        onClose();
      }, EXIT_MS);
    },
    [onClose, onConfirm],
  );

  useEffect(() => {
    if (!mounted || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss('cancel');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, visible, dismiss]);

  useEffect(() => {
    if (visible) {
      const id = requestAnimationFrame(() => confirmBtnRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [visible]);

  if (!mounted || typeof document === 'undefined') return null;

  const delta = actualPaid - plannedAmount;
  const planDiff = Math.abs(delta) > 0.005;
  const backdropAnim = visible ? 'bill-confirm-backdrop-in' : 'bill-confirm-backdrop-out';
  const panelAnim = visible ? 'bill-confirm-panel-in' : 'bill-confirm-panel-out';
  const monthKey = due.toISOString().slice(0, 7);

  return createPortal(
    <div
      className="fixed inset-0 isolate flex items-center justify-center p-4 sm:p-6 motion-reduce:transition-none"
      style={{ zIndex: zLayers.modal }}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-sage-950/65 backdrop-blur-md dark:bg-black/78 ${backdropAnim}`}
        aria-label={c.cancel}
        onClick={() => dismiss('cancel')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative w-full max-w-md will-change-transform ${panelAnim}`}
      >
        <div className="overflow-hidden rounded-[1.5rem] border-2 border-teal-500/35 bg-white shadow-[0_24px_80px_-12px_rgba(15,118,110,0.45)] ring-1 ring-white/20 dark:border-teal-400/25 dark:bg-moss-elevated dark:shadow-[0_28px_90px_-16px_rgba(0,0,0,0.65)]">
          <div
            className={`relative overflow-hidden px-6 py-5 text-white bill-confirm-shimmer ${visible ? '' : 'opacity-90'}`}
            style={{
              backgroundImage:
                'linear-gradient(110deg, #0f766e 0%, #115e59 22%, #134e4a 44%, #0d9488 66%, #115e59 88%, #0f766e 100%)',
              backgroundSize: '220% 100%',
            }}
          >
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-teal-300/20 blur-xl" aria-hidden />

            <div className="relative flex gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm bill-confirm-icon-pop"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-100/90">{c.eyebrow}</p>
                <h2 id={titleId} className="mt-1 font-display text-xl font-semibold leading-snug">
                  {c.title}
                </h2>
                <p className="mt-2 truncate text-sm font-medium text-teal-50/95">{billName}</p>
                <p className="mt-0.5 text-xs text-teal-100/75">Due {formatShortDate(due)}</p>
              </div>
            </div>
          </div>

          <div id={descId} className="px-6 py-5">
            <div className="bill-confirm-stagger-1 rounded-xl border border-sage-200/90 bg-gradient-to-b from-sage-50 to-white p-4 dark:border-moss-border dark:from-moss-bg/80 dark:to-moss-elevated">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-sage-600 dark:text-moss-muted">Plan</span>
                <span className="font-semibold tabular-nums text-sage-900 dark:text-moss-fg">
                  {formatMoney(plannedAmount)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-sage-600 dark:text-moss-muted">Actual paid</span>
                <span className="font-display text-base font-bold tabular-nums text-teal-900 dark:text-teal-200">
                  {formatMoney(actualPaid)}
                </span>
              </div>
              {planDiff ? (
                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300/90">
                  {delta >= 0 ? '+' : ''}
                  {formatMoney(delta)} vs plan
                </p>
              ) : (
                <p className="mt-2 text-xs text-sage-600 dark:text-moss-muted">Matches plan amount</p>
              )}
            </div>

            <p className="bill-confirm-stagger-2 mt-4 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
              {c.countsAsPaid(monthKey)}
            </p>

            <div
              className={`bill-confirm-stagger-3 mt-3 inline-flex items-center gap-2 rounded-full border border-teal-200/90 bg-teal-50/90 px-3 py-1.5 text-xs font-semibold text-teal-900 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-100/95 bill-confirm-chip-glow`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500 motion-safe:animate-pulse" />
              {c.incomeVsSpendChip(attributedAsLabel)}
            </div>

            <p className="bill-confirm-stagger-3 mt-2 text-[11px] leading-snug text-sage-500 dark:text-moss-muted">
              {c.signedInNote} {c.disclaimer}
            </p>

            <div className="bill-confirm-stagger-4 mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="btn-secondary w-full transition-transform duration-200 active:scale-[0.98] sm:w-auto"
                onClick={() => dismiss('cancel')}
              >
                {c.cancel}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                className="btn-primary w-full transition-transform duration-200 active:scale-[0.98] sm:w-auto"
                onClick={() => dismiss('confirm')}
              >
                {c.confirm}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
