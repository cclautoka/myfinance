import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { zLayers } from '../ui/zLayers';

type CopyField = 'link' | 'code';

export function PartnerInviteModal({
  open,
  onClose,
  inviteUrl,
  pairingCode,
  partnerEmail,
  verificationEmailSent,
  joinEmailSent,
}: {
  open: boolean;
  onClose: () => void;
  inviteUrl: string;
  pairingCode: string;
  partnerEmail?: string;
  verificationEmailSent?: boolean;
  joinEmailSent?: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<CopyField | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(null);
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
    const id = window.requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (field: CopyField, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
    } catch {
      /* ignore */
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 isolate flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: zLayers.modal }}
    >
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
        aria-describedby={descId}
        className="relative max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-sage-200/95 bg-white p-6 shadow-2xl ring-2 ring-black/5 dark:border-moss-border dark:bg-moss-elevated dark:ring-white/10"
      >
        <h2 id={titleId} className="font-display text-xl font-semibold text-sage-950 dark:text-moss-fg">
          Partner invite
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
          Share the pairing code in person. Your partner must verify their email first (we send a separate message), then
          open this invite link — it does not expire — and enter the code.
        </p>
        {partnerEmail ? (
          <p className="mt-3 rounded-lg border border-teal-200/80 bg-teal-50/60 px-3 py-2 text-sm text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-100">
            Partner: <strong>{partnerEmail}</strong>
            {verificationEmailSent ? (
              <span className="mt-1 block text-xs font-medium text-teal-900/90 dark:text-teal-200/90">
                Verification email sent — they must confirm before joining.
              </span>
            ) : joinEmailSent ? (
              <span className="mt-1 block text-xs font-medium text-teal-900/90 dark:text-teal-200/90">
                Invite email sent with the link and pairing code.
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sage-600 dark:text-moss-muted">
              Invite link
            </p>
            <p className="mt-1 break-all rounded-lg border border-sage-200/90 bg-sage-50/80 px-3 py-2 font-mono text-xs text-sage-900 dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg">
              {inviteUrl || '—'}
            </p>
            <button
              type="button"
              className="btn-secondary btn-secondary-sm mt-2 font-bold"
              disabled={!inviteUrl}
              onClick={() => void copy('link', inviteUrl)}
            >
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sage-600 dark:text-moss-muted">
              Pairing code (does not expire)
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.35em] text-teal-800 dark:text-teal-200">
              {pairingCode || '—'}
            </p>
            <button
              type="button"
              className="btn-secondary btn-secondary-sm mt-2 font-bold"
              disabled={!pairingCode}
              onClick={() => void copy('code', pairingCode)}
            >
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button type="button" ref={closeBtnRef} className="btn-primary font-bold" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
