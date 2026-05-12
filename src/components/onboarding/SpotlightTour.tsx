import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ONBOARDING_STEPS, ONBOARDING_STORAGE_KEY } from '../../onboarding/constants';

const PAD = 8;
const POPOVER_W = 352;
const POPOVER_H_EST = 300;
const SAFE = 16;

function readDismissed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismiss() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Bottom bar is `position: fixed` — `offsetParent` is often null; use geometry instead. */
function isTourTargetVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 8 && r.height > 8;
}

function queryTourElement(target: string): HTMLElement | null {
  if (target === 'tour-nav-shortcuts') {
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    const primary = wide ? 'tour-quick-nav' : 'tour-bottom-nav';
    const secondary = wide ? 'tour-bottom-nav' : 'tour-quick-nav';
    for (const key of [primary, secondary]) {
      const e = document.querySelector(`[data-tour="${key}"]`);
      if (e instanceof HTMLElement && isTourTargetVisible(e)) return e;
    }
    return null;
  }
  const el = document.querySelector(`[data-tour="${target}"]`);
  return el instanceof HTMLElement ? el : null;
}

function computePopoverStyle(hole: {
  top: number;
  left: number;
  width: number;
  height: number;
}): CSSProperties {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;

  if (hole.height > vh * 0.6) {
    return {
      position: 'fixed',
      right: SAFE,
      bottom: SAFE,
      left: 'auto',
      top: 'auto',
      width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
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

  if (top + POPOVER_H_EST > vh - SAFE) {
    top = Math.max(SAFE, vh - POPOVER_H_EST - SAFE);
  }
  top = Math.max(SAFE, top);

  return {
    position: 'fixed',
    left,
    top,
    width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
  };
}

/**
 * Mount with changing `key` in the parent to replay after “Replay tour” (parent clears storage, then bumps key).
 */
export function SpotlightTour() {
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && !readDismissed());
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: SAFE,
    bottom: SAFE,
    width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
  });

  const stepCount = ONBOARDING_STEPS.length;

  const closeAndRemember = useCallback(() => {
    persistDismiss();
    setVisible(false);
  }, []);

  const syncHole = useCallback(() => {
    const step = ONBOARDING_STEPS[stepIndex];
    if (!visible || !step) {
      setHole(null);
      setPopoverStyle({
        position: 'fixed',
        left: SAFE,
        bottom: SAFE,
        width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
      });
      return;
    }
    const el = queryTourElement(step.target);
    if (!el) {
      setHole(null);
      setPopoverStyle({
        position: 'fixed',
        left: SAFE,
        bottom: SAFE,
        width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
      });
      return;
    }
    const r = el.getBoundingClientRect();

    const h = Math.max(0, r.height + PAD * 2);
    /** Missing / collapsed target only (large sections like the dashboard can exceed viewport height). */
    if (r.height <= 8 || r.width <= 8) {
      setHole(null);
      setPopoverStyle({
        position: 'fixed',
        left: SAFE,
        bottom: SAFE,
        width: `min(${POPOVER_W}px, calc(100vw - ${SAFE * 2}px))`,
      });
      return;
    }

    const nextHole = {
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: h,
    };
    setHole(nextHole);
    setPopoverStyle(computePopoverStyle(nextHole));
  }, [stepIndex, visible]);

  useLayoutEffect(() => {
    if (!visible) return;
    const step = ONBOARDING_STEPS[stepIndex];
    if (!step) return;
    const el = queryTourElement(step.target);
    if (el) {
      if (step.target === 'tour-nav-shortcuts' && window.matchMedia('(min-width: 1024px)').matches) {
        window.scrollTo({ top: 0, behavior: stepIndex <= 1 ? 'auto' : 'smooth' });
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
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [stepIndex, visible, syncHole]);

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
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => queueHole()) : null;
    const observed = queryTourElement(ONBOARDING_STEPS[stepIndex]?.target ?? '');
    if (ro && observed instanceof HTMLElement) ro.observe(observed);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', queueHole, true);
      window.removeEventListener('resize', queueHole);
      ro?.disconnect();
    };
  }, [visible, stepIndex, syncHole]);

  if (!visible || typeof document === 'undefined') return null;

  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex >= stepCount - 1;

  const card = (
    <div
      className="fixed z-[60] flex max-h-[min(48vh,420px)] flex-col rounded-2xl border border-sage-900/25 bg-white p-5 shadow-2xl dark:border-white/15 dark:bg-moss-elevated"
      style={popoverStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sage-600 dark:text-moss-muted">
        Guided overview · step {stepIndex + 1} of {stepCount}
      </p>
      <h2 id="tour-title" className="mt-2 font-display text-xl font-semibold tracking-tight text-sage-900 dark:text-moss-fg">
        {step?.title}
      </h2>
      <p id="tour-body" className="mt-3 flex-1 overflow-y-auto text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">
        {step?.body}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-sage-200/80 pt-4 dark:border-moss-border">
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

  const overlay = (
    <>
      {hole == null ? (
        <div className="fixed inset-0 z-[55] bg-sage-950/75 dark:bg-black/80" aria-hidden />
      ) : (
        <div
          className="pointer-events-none fixed z-[56] rounded-xl"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            /** Single halo — no Tailwind ring (avoids double-outline artifacts). */
            boxShadow:
              '0 0 0 2px rgba(45, 212, 191, 0.85), 0 0 0 9999px rgba(15, 18, 14, 0.78)',
          }}
        />
      )}
      {card}
    </>
  );

  return createPortal(overlay, document.body);
}
