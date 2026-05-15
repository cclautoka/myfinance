import { useEffect, useRef, useState, type RefObject } from 'react';

/** Content fits without meaningful scroll — dwell before advancing. */
const SHORT_SCROLL_THRESHOLD_PX = 32;
export const SHORT_SLIDE_DWELL_MS = 5000;
/** ~3 screen lines per second at typical density. */
const SCROLL_PX_PER_SECOND = 44;
const END_PAUSE_MS = 700;
const BOTTOM_TOLERANCE_PX = 4;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type UseDemoSlideAutoplayArgs = {
  scrollRef: RefObject<HTMLDivElement | null>;
  slideKey: string;
  paused: boolean;
  onAdvance: () => void;
};

/**
 * Per slide: scroll to bottom at a readable speed, then advance.
 * Short content (little overflow): wait {@link SHORT_SLIDE_DWELL_MS} before advancing.
 */
export function useDemoSlideAutoplay({ scrollRef, slideKey, paused, onAdvance }: UseDemoSlideAutoplayArgs) {
  const [progress, setProgress] = useState(0);
  const runIdRef = useRef(0);
  const pausedRef = useRef(paused);
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const signal = { cancelled: false };
    const runId = ++runIdRef.current;

    const waitWhilePaused = async () => {
      while (!signal.cancelled && runId === runIdRef.current && pausedRef.current) {
        if (signal.cancelled) return;
        await sleep(80);
      }
    };

    const dwell = async (ms: number) => {
      const start = performance.now();
      while (!signal.cancelled && runId === runIdRef.current) {
        await waitWhilePaused();
        const elapsed = performance.now() - start;
        setProgress(Math.min(1, elapsed / ms));
        if (elapsed >= ms) break;
        if (signal.cancelled) return;
        await sleep(50);
      }
    };

    const measureMaxScroll = () => {
      return Math.max(0, el.scrollHeight - el.clientHeight);
    };

    const run = async () => {
      el.scrollTop = 0;
      setProgress(0);

      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      if (signal.cancelled || runId !== runIdRef.current) return;

      let maxScroll = measureMaxScroll();
      if (maxScroll <= SHORT_SCROLL_THRESHOLD_PX) {
        await sleep(120);
        maxScroll = measureMaxScroll();
      }

      const reduced = prefersReducedMotion();

      if (maxScroll <= SHORT_SCROLL_THRESHOLD_PX) {
        await dwell(reduced ? 2000 : SHORT_SLIDE_DWELL_MS);
        if (!signal.cancelled && runId === runIdRef.current) {
          setProgress(1);
          onAdvanceRef.current();
        }
        return;
      }

      if (reduced) {
        el.scrollTop = maxScroll;
        setProgress(1);
        await dwell(1500);
        if (!signal.cancelled && runId === runIdRef.current) onAdvanceRef.current();
        return;
      }

      const durationMs = Math.max(1200, (maxScroll / SCROLL_PX_PER_SECOND) * 1000);
      const startTime = performance.now();

      while (!signal.cancelled && runId === runIdRef.current) {
        await waitWhilePaused();
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / durationMs);
        el.scrollTop = t * maxScroll;
        setProgress(t * 0.92);

        if (el.scrollTop >= maxScroll - BOTTOM_TOLERANCE_PX || t >= 1) break;
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }

      if (signal.cancelled || runId !== runIdRef.current) return;

      el.scrollTop = maxScroll;
      setProgress(0.96);
      await dwell(END_PAUSE_MS);
      if (!signal.cancelled && runId === runIdRef.current) {
        setProgress(1);
        onAdvanceRef.current();
      }
    };

    void run();

    return () => {
      signal.cancelled = true;
    };
  }, [slideKey, scrollRef]);

  return progress;
}
