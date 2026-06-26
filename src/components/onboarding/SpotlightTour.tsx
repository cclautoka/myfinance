import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_TOUR_LATER_KEY,
  onboardingStepsForContext,
} from '../../onboarding/constants';
import { zLayers } from '../../ui/zLayers';
import { getStickyChromeBottomPx, holeRectForTourTarget } from '../../utils/spotlightStickyChrome';

const PAD = 8;
const POPOVER_W = 352;
const POPOVER_H_EST = 300;
const SAFE = 16;

function readDismissed(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1') return true;
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismiss() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    // Some webviews wipe localStorage on auth transitions; keep a session fallback so it doesn't re-open immediately.
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

function mobileBottomNavOffsetPx(): number {
  if (typeof window === 'undefined') return 0;
  return window.matchMedia('(max-width: 1023.98px)').matches ? 56 : 0;
}

/** True when the element participates in layout (not inside a closed tab / display:none chain). */
function isVisibleForSpotlight(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (n.hidden) return false;
    if (n.getAttribute('aria-hidden') === 'true') return false;
    if (typeof window !== 'undefined') {
      const st = window.getComputedStyle(n);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
    }
  }
  const r = el.getBoundingClientRect();
  return r.width > 8 && r.height > 8;
}

function queryTourElement(target: string): HTMLElement | null {
  if (target === 'tour-nav-shortcuts') {
    const nodes = document.querySelectorAll('[data-tour="tour-nav-shortcuts"]');
    for (const node of nodes) {
      if (node instanceof HTMLElement && isVisibleForSpotlight(node)) return node;
    }
    return null;
  }
  const nodes = document.querySelectorAll(`[data-tour="${CSS.escape(target)}"]`);
  for (const node of nodes) {
    if (node instanceof HTMLElement && isVisibleForSpotlight(node)) return node;
  }
  return null;
}

/** Four fixed panels around the spotlight hole so dimmed areas receive clicks (tour “remind later”). */
function holeBackdropPanels(hole: { top: number; left: number; width: number; height: number }): {
  key: string;
  style: CSSProperties;
}[] {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  if (vw <= 0 || vh <= 0) return [];
  const top = Math.max(0, hole.top);
  const left = Math.max(0, hole.left);
  const right = Math.min(vw, hole.left + hole.width);
  const bottom = Math.min(vh, hole.top + hole.height);
  const panels: { key: string; style: CSSProperties }[] = [];
  if (top > 0) {
    panels.push({ key: 't', style: { top: 0, left: 0, width: vw, height: top } });
  }
  if (bottom < vh) {
    panels.push({ key: 'b', style: { top: bottom, left: 0, width: vw, height: vh - bottom } });
  }
  const midH = Math.max(0, bottom - top);
  if (left > 0 && midH > 0) {
    panels.push({ key: 'l', style: { top: top, left: 0, width: left, height: midH } });
  }
  if (right < vw && midH > 0) {
    panels.push({ key: 'r', style: { top: top, left: right, width: vw - right, height: midH } });
  }
  return panels;
}

function computePopoverStyle(hole: {
  top: number;
  left: number;
  width: number;
  height: number;
}): CSSProperties {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const navPad = mobileBottomNavOffsetPx();
  const minTop = Math.max(SAFE, getStickyChromeBottomPx() + 8);

  if (hole.height > vh * 0.6) {
    return {
      position: 'fixed',
      right: SAFE,
      bottom: SAFE + navPad,
      left: 'auto',
      top: 'auto',
      maxHeight: `min(56vh, 28rem)`,
      width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
      zIndex: zLayers.spotlightPopover,
    };
  }

  let left = hole.left + hole.width + SAFE;
  let top = hole.top;

  if (left + POPOVER_W > vw - SAFE) {
    left = hole.left - POPOVER_W - SAFE;
  }
  if (left < SAFE) {
    left = SAFE;
    top = hole.top + hole.height + SAFE;
  }

  if (top + POPOVER_H_EST > vh - SAFE - navPad) {
    top = Math.max(minTop, vh - POPOVER_H_EST - SAFE - navPad);
  }
  top = Math.max(minTop, top);

  return {
    position: 'fixed',
    left,
    top,
    maxHeight: `min(56vh, 28rem)`,
    width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
    zIndex: zLayers.spotlightPopover,
  };
}

function defaultTourPopoverStyle(): CSSProperties {
  return {
    position: 'fixed',
    left: SAFE,
    bottom: SAFE + mobileBottomNavOffsetPx(),
    width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
    zIndex: zLayers.spotlightPopover,
  };
}

/**
 * Mount with changing `key` in the parent to replay after “Replay tour” (parent clears storage, then bumps key).
 */
export function SpotlightTour({
  onPrepareStep,
  householdSignedIn = false,
  layoutSyncKey = '',
  serverDismissed = false,
  onDismiss,
}: {
  /** e.g. open Tools tab before highlighting `tour-tools-notify`. */
  onPrepareStep?: (stepIndex: number) => void;
  /** Affects Tools-step copy (local relay vs signed-in server features). */
  householdSignedIn?: boolean;
  /** When this changes after prepare (e.g. workspace tab), hole geometry is re-measured. */
  layoutSyncKey?: string;
  /** Account-level dismissal synced from server state — keeps the tour closed across logins/devices. */
  serverDismissed?: boolean;
  /** Called when the user finishes or skips the tour, so the parent can persist it to server state. */
  onDismiss?: () => void;
}) {
  const steps = useMemo(
    () => onboardingStepsForContext({ householdSignedIn }),
    [householdSignedIn],
  );

  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && !readDismissed() && !serverDismissed,
  );

  useEffect(() => {
    if (serverDismissed) setVisible(false);
  }, [serverDismissed]);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>(() => defaultTourPopoverStyle());

  const firstFocusRef = useRef<HTMLButtonElement | null>(null);
  const stepCount = steps.length;

  const closeAndRemember = useCallback(() => {
    persistDismiss();
    onDismiss?.();
    setVisible(false);
  }, [onDismiss]);

  const remindLater = useCallback(() => {
    try {
      sessionStorage.setItem(ONBOARDING_TOUR_LATER_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, []);

  const syncHole = useCallback(() => {
    const step = steps[stepIndex];
    if (!visible || !step) {
      setHole(null);
      setPopoverStyle(defaultTourPopoverStyle());
      return;
    }
    const el = queryTourElement(step.target);
    if (!el) {
      setHole(null);
      setPopoverStyle(defaultTourPopoverStyle());
      return;
    }

    const nextHole = holeRectForTourTarget(el, PAD);
    if (!nextHole) {
      setHole(null);
      setPopoverStyle(defaultTourPopoverStyle());
      return;
    }
    setHole(nextHole);
    setPopoverStyle(computePopoverStyle(nextHole));
  }, [stepIndex, visible, steps]);

  const spotlightTimeoutsRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    spotlightTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    spotlightTimeoutsRef.current = [];
    if (!visible) return;
    onPrepareStep?.(stepIndex);

    let cancelled = false;
    let rafOuter = 0;

    const runScrollAndScheduleHole = () => {
      if (cancelled) return;
      const step = steps[stepIndex];
      if (!step) return;
      const el = queryTourElement(step.target);
      if (el) {
        if (step.target === 'tour-nav-shortcuts' && window.matchMedia('(min-width: 1024px)').matches) {
          window.scrollTo({ top: 0, behavior: stepIndex <= 2 ? 'auto' : 'smooth' });
        }
        const block = step.scrollBlock ?? 'center';
        el.scrollIntoView({
          behavior: stepIndex === 0 ? 'auto' : 'smooth',
          block,
          inline: 'nearest',
        });
      }
      const delay = stepIndex === 0 ? 120 : 400;
      const t1 = window.setTimeout(syncHole, delay);
      const t2 = window.setTimeout(syncHole, delay + 150);
      const t3 = window.setTimeout(syncHole, delay + 380);
      spotlightTimeoutsRef.current.push(t1, t2, t3);
    };

    rafOuter = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runScrollAndScheduleHole);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafOuter);
      spotlightTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      spotlightTimeoutsRef.current = [];
    };
  }, [stepIndex, visible, syncHole, onPrepareStep, steps, layoutSyncKey]);

  useLayoutEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => firstFocusRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [visible, stepIndex]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndRemember();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, closeAndRemember]);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const queueHole = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => syncHole());
    };
    queueHole();
    window.addEventListener('scroll', queueHole, true);
    window.addEventListener('resize', queueHole);
    window.visualViewport?.addEventListener('resize', queueHole);
    window.visualViewport?.addEventListener('scroll', queueHole);
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => queueHole()) : null;
    const observed = queryTourElement(steps[stepIndex]?.target ?? '');
    if (ro && observed instanceof HTMLElement) ro.observe(observed);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', queueHole, true);
      window.removeEventListener('resize', queueHole);
      window.visualViewport?.removeEventListener('resize', queueHole);
      window.visualViewport?.removeEventListener('scroll', queueHole);
      ro?.disconnect();
    };
  }, [visible, stepIndex, syncHole, steps, layoutSyncKey]);

  if (!visible || typeof document === 'undefined') return null;

  const step = steps[stepIndex];
  const isLast = stepIndex >= stepCount - 1;
  const progress = ((stepIndex + 1) / stepCount) * 100;

  const card = (
    <div
      className="pointer-events-auto fixed flex max-h-[min(56vh,28rem)] flex-col overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-white p-5 shadow-2xl shadow-slate-900/15 dark:border-moss-border dark:bg-moss-elevated dark:shadow-black/50"
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-moss-border" aria-hidden>
        <div
          className="h-full rounded-full bg-teal-500 transition-[width] duration-300 ease-out dark:bg-teal-400/90"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-moss-muted">
        Guided overview · step {stepIndex + 1} of {stepCount}
      </p>
      <h2 id="tour-title" className="mt-2 font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-moss-fg">
        {step?.title}
      </h2>
      <p id="tour-body" className="mt-3 flex-1 overflow-y-auto text-sm leading-relaxed text-slate-600 dark:text-moss-subtle">
        {step?.body}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200/90 pt-4 dark:border-moss-border">
        <button type="button" className="btn-secondary btn-secondary-sm" onClick={remindLater}>
          Remind me later
        </button>
        <button type="button" className="btn-secondary btn-secondary-sm" onClick={closeAndRemember}>
          Skip and don&apos;t show again
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-secondary-sm"
            disabled={stepIndex <= 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </button>
          <button
            ref={firstFocusRef}
            type="button"
            className="btn-primary btn-primary-sm"
            onClick={() => {
              if (isLast) closeAndRemember();
              else setStepIndex((i) => Math.min(stepCount - 1, i + 1));
            }}
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );

  const dimPanels = hole ? holeBackdropPanels(hole) : [];

  const overlay = (
    <>
      {hole == null ? (
        <button
          type="button"
          className="pointer-events-auto fixed inset-0 cursor-default border-0 bg-slate-950/70 p-0 dark:bg-black/80"
          style={{ zIndex: zLayers.spotlightBackdrop }}
          aria-label="Dismiss tour"
          onClick={closeAndRemember}
        />
      ) : (
        <>
          {dimPanels.map((p) => (
            <button
              key={p.key}
              type="button"
              className="pointer-events-auto fixed cursor-default border-0 bg-slate-950/70 p-0 dark:bg-black/80"
              style={{ ...p.style, zIndex: zLayers.spotlightBackdrop }}
              aria-label="Defer tour"
              onClick={remindLater}
            />
          ))}
          <div
            className="pointer-events-none fixed rounded-xl"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              boxShadow:
                '0 0 0 2px rgba(45, 212, 191, 0.98), 0 0 0 5px rgba(45, 212, 191, 0.18), 0 0 26px rgba(45, 212, 191, 0.4)',
              zIndex: zLayers.spotlightRing,
            }}
          />
        </>
      )}
      {card}
    </>
  );

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: zLayers.spotlightBackdrop, isolation: 'isolate' }}
    >
      {overlay}
    </div>,
    document.body,
  );
}
