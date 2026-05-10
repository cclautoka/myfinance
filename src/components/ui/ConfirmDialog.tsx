import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** Shown when `showCancel`; defaults to Cancel. */
  cancelLabel?: string;
  confirmLabel?: string;
  variant?: 'default' | 'danger';
  /** When false, only the primary button is shown (notice / acknowledge). */
  showCancel?: boolean;
  /** Fires before `onClose` when the user confirms. */
  onConfirm?: () => void;
};

/**
 * Accessible modal replacing `window.confirm` / `alert` — matches Household panel styling.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  variant = 'default',
  showCancel = true,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const destructive = variant === 'danger';
  const primaryLabel =
    confirmLabel ?? (showCancel ? (destructive ? 'Remove' : 'Confirm') : 'OK');

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      if (showCancel) cancelBtnRef.current?.focus();
      else confirmBtnRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, showCancel]);

  if (!open || typeof document === 'undefined') return null;

  const portal = (
    <div className="fixed inset-0 z-[10002] isolate flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-sage-950/55 backdrop-blur-[2px] dark:bg-black/70"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-sage-200/95 bg-white p-6 shadow-2xl ring-2 ring-black/5 dark:border-moss-border dark:bg-moss-elevated dark:ring-white/10"
      >
        <h2 id={titleId} className="font-display text-xl font-semibold text-sage-950 dark:text-moss-fg">
          {title}
        </h2>
        {description != null && description !== '' && (
          <p id={descId} className="mt-3 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
            {description}
          </p>
        )}
        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          {showCancel && (
            <button
              type="button"
              ref={cancelBtnRef}
              onClick={onClose}
              className="btn-secondary w-full sm:w-auto"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            ref={confirmBtnRef}
            className={`w-full shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-moss-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-moss-elevated sm:w-auto ${
              destructive
                ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600'
                : 'btn-primary'
            }`}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}
