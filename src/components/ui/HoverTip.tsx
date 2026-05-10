import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const LEAVE_CLOSE_MS = 140;

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
  const spaceAbove = ar.top - VIEW_PAD;
  const spaceBelow = vh - ar.bottom - VIEW_PAD;

  if (top < VIEW_PAD) {
    if (spaceBelow >= th + GAP_PX || spaceBelow > spaceAbove) {
      top = ar.bottom + GAP_PX;
    } else {
      top = VIEW_PAD;
    }
  } else if (top + th > vh - VIEW_PAD) {
    top = Math.max(VIEW_PAD, vh - VIEW_PAD - th);
  }

  let left = ar.left + ar.width / 2 - tw / 2;
  left = Math.max(VIEW_PAD, Math.min(left, vw - VIEW_PAD - tw));

  tipEl.style.position = 'fixed';
  tipEl.style.top = `${Math.round(top)}px`;
  tipEl.style.left = `${Math.round(left)}px`;
  tipEl.style.zIndex = String(Z_TOOLTIP);
}

/**
 * Hover or keyboard-focus the bordered area shows extra context.
 * Tooltip is portaled to `document.body` with fixed positioning so it stays in the viewport
 * (flips above/below, clamps horizontally) and is not clipped by overflow parents.
 */
export function HoverTip({
  content,
  children,
  className = '',
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setOpen(false), LEAVE_CLOSE_MS);
  }, [clearLeaveTimer]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const reposition = useCallback(() => {
    const a = anchorRef.current;
    const t = tipRef.current;
    if (!open || !a || !t) return;
    placeFloatingTip(a, t);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(id);
  }, [open, content, reposition]);

  useLayoutEffect(() => {
    if (!open || !tipRef.current) return;
    const ro = new ResizeObserver(() => reposition());
    ro.observe(tipRef.current);
    return () => ro.disconnect();
  }, [open, reposition]);

  useLayoutEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => reposition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, reposition]);

  const floating =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={tipRef}
        className="rounded-xl border border-sage-300/90 bg-white px-3 py-3 text-left text-[13px] leading-relaxed text-sage-800 shadow-xl dark:border-moss-border dark:bg-moss-elevated dark:text-moss-tip"
        role="tooltip"
        tabIndex={-1}
        onMouseEnter={() => clearLeaveTimer()}
        onMouseLeave={() => setOpen(false)}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-sage-500 dark:text-moss-muted">
          Details
        </p>
        <div className="mt-1.5">{content}</div>
      </div>,
      document.body,
    );

  return (
    <>
      <div
        ref={anchorRef}
        className={`group/tip relative outline-none focus-visible:ring-2 focus-visible:ring-moss-500/40 dark:focus-visible:ring-moss-400/30 ${className}`}
        tabIndex={0}
        onMouseEnter={() => {
          clearLeaveTimer();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocusCapture={() => {
          clearLeaveTimer();
          setOpen(true);
        }}
        onBlurCapture={(e) => {
          if (!anchorRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
      {floating}
    </>
  );
}

/** Dotted underline label — hover or focus reveals details. */
export function LabelWithHoverTip({
  label,
  content,
}: {
  label: ReactNode;
  content: ReactNode;
}) {
  return (
    <HoverTip content={content} className="inline-flex max-w-full flex-col">
      <span className="inline-flex cursor-default flex-wrap items-baseline gap-1.5 border-b border-dotted border-sage-400/40 pb-px dark:border-moss-muted/35">
        {label}
      </span>
    </HoverTip>
  );
}
