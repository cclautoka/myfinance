import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { zLayers } from '../../ui/zLayers';

/**
 * Centers a dialog in the visible viewport via a body portal — avoids `fixed` being
 * trapped by transformed ancestors when the page is scrolled (e.g. Workspace tab).
 */
export function ModalViewport({
  open,
  onClose,
  ariaLabelledBy,
  ariaDescribedBy,
  panelClassName = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 isolate flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: zLayers.modal }}
    >
      <button
        type="button"
        className="bill-confirm-backdrop-in absolute inset-0 bg-sage-950/70 backdrop-blur-sm dark:bg-black/75"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className={`bill-confirm-panel-in relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-sage-200/90 bg-white p-6 shadow-2xl dark:border-moss-border dark:bg-moss-elevated ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
