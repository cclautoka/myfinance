import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { InfoIcon } from './InfoIcon';

const LEAVE_CLOSE_MS = 160;
const OPEN_DELAY_MS_FINE = 220;
const FINE_HOVER_MQ = '(hover: hover) and (pointer: fine)';

const GAP_PX = 12;
const VIEW_PAD = 12;
const Z_TOOLTIP = 250;

export type HoverTipInteraction = 'auto' | 'hover' | 'tap';

/** `wrap` = default block; `inline-end` = title row + trailing info control; `corner` = absolute info control over relative parent. */
export type HoverTipLayout = 'wrap' | 'inline-end' | 'corner';

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

function usePrefersFineHover(): boolean {
  const [fine, setFine] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(FINE_HOVER_MQ).matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia(FINE_HOVER_MQ);
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return fine;
}

function InfoTrigger({
  open,
  triggerRef,
  onClick,
  compact = false,
}: {
  open: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  compact?: boolean;
}) {
  const sizeClass = compact
    ? 'h-8 w-8 min-h-8 min-w-8'
    : 'h-11 min-h-[44px] w-11 min-w-[44px]';
  return (
    <button
      ref={triggerRef}
      type="button"
      className={`inline-flex ${sizeClass} shrink-0 items-center justify-center rounded-full border border-sage-300/90 bg-white text-teal-800 shadow-sm transition-all duration-200 hover:scale-105 hover:border-teal-500/60 hover:bg-teal-50/80 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:border-moss-border dark:bg-moss-surface dark:text-teal-200 dark:hover:border-teal-500/40 dark:hover:bg-teal-950/30 dark:focus-visible:ring-teal-400 dark:focus-visible:ring-offset-moss-bg`}
      aria-expanded={open}
      aria-label="More info"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <InfoIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
    </button>
  );
}

/**
 * Extra context: on fine pointers + hover mode, opens after a short delay when the pointer enters the anchor
 * (or immediately on keyboard focus). On touch / coarse pointers, or when `interaction="tap"`, opens only
 * from the info control. Portaled so tips are not clipped by overflow parents.
 */
export function HoverTip({
  content,
  children,
  className = '',
  interaction = 'auto',
  layout = 'wrap',
  compactTrigger = false,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  interaction?: HoverTipInteraction;
  layout?: HoverTipLayout;
  /** Smaller info button for metric cards (corner layout). */
  compactTrigger?: boolean;
}) {
  const fineHover = usePrefersFineHover();
  const useHoverOpen = interaction === 'tap' ? false : fineHover;
  const showTrigger =
    interaction === 'tap' ||
    (interaction === 'auto' && !fineHover) ||
    (interaction === 'hover' && !fineHover) ||
    layout === 'inline-end' ||
    layout === 'corner';

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setOpen(false), LEAVE_CLOSE_MS);
  }, [clearLeaveTimer]);

  useEffect(
    () => () => {
      clearLeaveTimer();
      clearOpenTimer();
    },
    [clearLeaveTimer, clearOpenTimer],
  );

  const positioningEl = useCallback((): HTMLElement | null => {
    if (showTrigger && triggerRef.current) return triggerRef.current;
    return anchorRef.current;
  }, [showTrigger]);

  const reposition = useCallback(() => {
    const a = positioningEl();
    const t = tipRef.current;
    if (!open || !a || !t) return;
    placeFloatingTip(a, t);
  }, [open, positioningEl]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(id);
  }, [open, content, reposition, showTrigger]);

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
      const tip = tipRef.current;
      const anchor = anchorRef.current;
      const trig = triggerRef.current;
      if (tip?.contains(t) || anchor?.contains(t) || trig?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const scheduleOpenHover = useCallback(() => {
    if (!useHoverOpen || showTrigger) return;
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS_FINE);
  }, [clearOpenTimer, showTrigger, useHoverOpen]);

  const onMouseEnterHover = useCallback(() => {
    if (!useHoverOpen || showTrigger) return;
    clearLeaveTimer();
    scheduleOpenHover();
  }, [clearLeaveTimer, scheduleOpenHover, showTrigger, useHoverOpen]);

  const onMouseLeaveHover = useCallback(() => {
    if (!useHoverOpen || showTrigger) return;
    clearOpenTimer();
    scheduleClose();
  }, [clearOpenTimer, scheduleClose, showTrigger, useHoverOpen]);

  const onFocusCapture = useCallback(() => {
    if (showTrigger) return;
    clearOpenTimer();
    clearLeaveTimer();
    setOpen(true);
  }, [clearLeaveTimer, clearOpenTimer, showTrigger]);

  const onBlurCapture = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (showTrigger) return;
      if (!anchorRef.current?.contains(e.relatedTarget as Node)) {
        setOpen(false);
      }
    },
    [showTrigger],
  );

  const toggleTrigger = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const floating =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={tipRef}
        className="rounded-xl border border-sage-300/90 bg-white px-3 py-3 text-left text-[13px] leading-relaxed text-sage-800 shadow-xl dark:border-moss-border dark:bg-moss-elevated dark:text-moss-tip"
        role="tooltip"
        tabIndex={-1}
        onMouseEnter={() => {
          if (!useHoverOpen || showTrigger) return;
          clearLeaveTimer();
          clearOpenTimer();
        }}
        onMouseLeave={() => {
          if (!useHoverOpen || showTrigger) return;
          setOpen(false);
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-sage-500 dark:text-moss-muted">
          Details
        </p>
        <div className="mt-1.5">{content}</div>
      </div>,
      document.body,
    );

  const triggerBtn = showTrigger ? (
    <InfoTrigger open={open} triggerRef={triggerRef} onClick={toggleTrigger} compact={compactTrigger || layout === 'corner'} />
  ) : null;

  const body = (
    <div
      className={
        layout === 'corner'
          ? 'min-h-0 min-w-0'
          : layout === 'inline-end'
            ? 'min-w-0 flex-1'
            : showTrigger
              ? 'min-h-0 min-w-0 flex-1'
              : 'min-h-0 min-w-0'
      }
      tabIndex={!showTrigger && useHoverOpen ? 0 : undefined}
      onMouseEnter={!showTrigger && useHoverOpen ? onMouseEnterHover : undefined}
      onMouseLeave={!showTrigger && useHoverOpen ? onMouseLeaveHover : undefined}
      onFocusCapture={!showTrigger && useHoverOpen ? onFocusCapture : undefined}
      onBlurCapture={!showTrigger && useHoverOpen ? onBlurCapture : undefined}
    >
      {children}
    </div>
  );

  const shell =
    layout === 'inline-end' ? (
      <div
        ref={anchorRef}
        className={`flex min-w-0 items-start justify-between gap-2 outline-none ${className}`}
      >
        {body}
        {triggerBtn}
      </div>
    ) : layout === 'corner' ? (
      <div ref={anchorRef} className={`relative min-w-0 outline-none ${className}`}>
        {triggerBtn ? (
          <div className="pointer-events-auto absolute right-1 top-1 z-10 sm:right-1.5 sm:top-1.5">{triggerBtn}</div>
        ) : null}
        <div className={triggerBtn ? 'min-w-0 pr-10 pt-0.5' : 'min-w-0'}>{body}</div>
      </div>
    ) : (
      <div
        ref={anchorRef}
        className={`relative flex min-h-0 min-w-0 flex-col outline-none focus-visible:ring-2 focus-visible:ring-moss-500/40 dark:focus-visible:ring-moss-400/30 ${
          showTrigger ? 'gap-2' : ''
        } ${className}`}
        tabIndex={!showTrigger && useHoverOpen ? 0 : undefined}
        onMouseEnter={!showTrigger && useHoverOpen ? onMouseEnterHover : undefined}
        onMouseLeave={!showTrigger && useHoverOpen ? onMouseLeaveHover : undefined}
        onFocusCapture={!showTrigger && useHoverOpen ? onFocusCapture : undefined}
        onBlurCapture={!showTrigger && useHoverOpen ? onBlurCapture : undefined}
      >
        {showTrigger ? <div className="flex shrink-0 justify-end">{triggerBtn}</div> : null}
        {showTrigger ? body : children}
      </div>
    );

  /** `wrap` + hover: single focusable wrapper around `children` (no duplicate body). */
  if (layout === 'wrap' && !showTrigger) {
    return (
      <>
        <div
          ref={anchorRef}
          className={`group/tip relative min-h-0 min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-moss-500/40 dark:focus-visible:ring-moss-400/30 ${className}`}
          tabIndex={useHoverOpen ? 0 : undefined}
          onMouseEnter={useHoverOpen ? onMouseEnterHover : undefined}
          onMouseLeave={useHoverOpen ? onMouseLeaveHover : undefined}
          onFocusCapture={useHoverOpen ? onFocusCapture : undefined}
          onBlurCapture={useHoverOpen ? onBlurCapture : undefined}
        >
          {children}
        </div>
        {floating}
      </>
    );
  }

  return (
    <>
      {shell}
      {floating}
    </>
  );
}

/** Dotted underline label — fine hover: delayed tooltip on the label; touch: info control. */
export function LabelWithHoverTip({
  label,
  content,
}: {
  label: ReactNode;
  content: ReactNode;
}) {
  return (
    <HoverTip content={content} interaction="auto" layout="wrap" className="inline-flex max-w-full">
      <span className="inline-flex max-w-full cursor-default flex-wrap items-baseline gap-1.5 border-b border-dotted border-sage-400/40 pb-px dark:border-moss-muted/35">
        {label}
      </span>
    </HoverTip>
  );
}
