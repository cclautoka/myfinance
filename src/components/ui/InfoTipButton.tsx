import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { InfoIcon } from './InfoIcon';

const GAP_PX = 12;
const VIEW_PAD = 12;
const Z_TOOLTIP = 250;

function placeFloatingTip(anchorEl: HTMLElement, tipEl: HTMLElement): void {
  const ar = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  tipEl.style.maxWidth = `${Math.min(22 * 16, vw - VIEW_PAD * 2)}px`;
  tipEl.style.maxHeight = `${Math.min(Math.round(vh * 0.55), vh - VIEW_PAD * 2)}px`;
  tipEl.style.overflowY = 'auto';

  const rect = tipEl.getBoundingClientRect();
  const tw = Math.max(rect.width, tipEl.offsetWidth, 1);
  const th = Math.max(rect.height, tipEl.offsetHeight, 1);

  let top = ar.top - GAP_PX - th;
  if (top < VIEW_PAD) top = ar.bottom + GAP_PX;
  if (top + th > vh - VIEW_PAD) top = Math.max(VIEW_PAD, vh - VIEW_PAD - th);

  let left = ar.left + ar.width / 2 - tw / 2;
  left = Math.max(VIEW_PAD, Math.min(left, vw - VIEW_PAD - tw));

  tipEl.style.position = 'fixed';
  tipEl.style.top = `${Math.round(top)}px`;
  tipEl.style.left = `${Math.round(left)}px`;
  tipEl.style.zIndex = String(Z_TOOLTIP);
}

/** Standalone info button + tooltip (no layout side-effects). */
export function InfoTipButton({ content, className = '' }: { content: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const a = triggerRef.current;
    const t = tipRef.current;
    if (!open || !a || !t) return;
    placeFloatingTip(a, t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(id);
  }, [open, content, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (tipRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const floating =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={tipRef}
        className="rounded-xl border border-teal-200/90 bg-white/95 px-3 py-3 text-left text-[13px] leading-relaxed text-sage-800 shadow-xl backdrop-blur-sm dark:border-teal-800/50 dark:bg-moss-elevated/95 dark:text-moss-tip"
        role="tooltip"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/90 dark:text-teal-200/90">
          Details
        </p>
        <div className="mt-1.5">{content}</div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`info-tip-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-teal-400/40 bg-gradient-to-br from-white to-teal-50/90 text-teal-800 shadow-sm transition-all duration-200 hover:scale-105 hover:border-teal-500/70 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-teal-500/35 dark:from-moss-surface dark:to-teal-950/40 dark:text-teal-100 dark:focus-visible:ring-offset-moss-bg ${className}`}
        aria-expanded={open}
        aria-label="More info"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <InfoIcon className="h-[18px] w-[18px]" />
      </button>
      {floating}
    </>
  );
}
