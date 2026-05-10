import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const PAD = 8;
const AUTO_DISMISS_MS = 3200;

/** Bottom edge of sticky header + section nav — hole must not start above this or the frame paints over the chrome. */
function getStickyChromeBottomPx(): number {
  let y = 0;
  const header = document.querySelector('header');
  const nav = document.getElementById('finance-quick-nav');
  if (header instanceof HTMLElement) y = Math.max(y, header.getBoundingClientRect().bottom);
  if (nav instanceof HTMLElement) y = Math.max(y, nav.getBoundingClientRect().bottom);
  return y;
}

/** Viewport rect for the halo, clipped so it does not sit under sticky top chrome (measured live). */
function holeRectForTarget(el: HTMLElement): {
  top: number;
  left: number;
  width: number;
  height: number;
} | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 8 || r.height <= 8) return null;

  const chromeBottom = getStickyChromeBottomPx();
  let top = r.top - PAD;
  let height = r.height + PAD * 2;
  const left = r.left - PAD;
  const width = r.width + PAD * 2;

  if (chromeBottom > 1 && top < chromeBottom) {
    const eat = chromeBottom - top;
    top = chromeBottom;
    height = Math.max(56, height - eat);
  }

  const vh = typeof window !== 'undefined' ? window.innerHeight : height;
  if (top + height > vh) {
    height = Math.max(48, vh - top - PAD);
  }

  if (height < 40 || width < 40) return null;

  return { top, left, width, height };
}

/**
 * One-shot “focus” overlay: dims the page and frames a single element (same hole technique as SpotlightTour).
 * Pointer events pass through so the highlighted column stays usable.
 */
export function TimelineColumnSpotlight({
  open,
  onClose,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetId: string;
}) {
  const [hole, setHole] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );

  const syncHole = useCallback(() => {
    if (!open) {
      setHole(null);
      return;
    }
    const el = document.getElementById(targetId);
    if (!el) {
      setHole(null);
      return;
    }
    const next = holeRectForTarget(el);
    setHole(next);
  }, [open, targetId]);

  useLayoutEffect(() => {
    if (!open) return;
    syncHole();
    const t1 = window.setTimeout(syncHole, 400);
    const t2 = window.setTimeout(syncHole, 900);
    const t3 = window.setTimeout(syncHole, 1600);
    const t4 = window.setTimeout(syncHole, 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [open, syncHole]);

  useEffect(() => {
    if (!open) return;
    const auto = window.setTimeout(onClose, AUTO_DISMISS_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    let raf = 0;
    const queue = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncHole);
    };
    window.addEventListener('scroll', queue, true);
    window.addEventListener('resize', queue);
    window.visualViewport?.addEventListener('resize', queue);
    window.visualViewport?.addEventListener('scroll', queue);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(queue) : null;
    const el = document.getElementById(targetId);
    if (ro && el) ro.observe(el);
    return () => {
      window.clearTimeout(auto);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', queue, true);
      window.removeEventListener('resize', queue);
      window.visualViewport?.removeEventListener('resize', queue);
      window.visualViewport?.removeEventListener('scroll', queue);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [open, onClose, syncHole, targetId]);

  if (!open || typeof document === 'undefined') return null;

  const halo = (
    <>
      {hole == null ? (
        <div className="fixed inset-0 z-[80] bg-sage-950/75 dark:bg-black/80" aria-hidden />
      ) : (
        <div
          className="pointer-events-none fixed z-[81] rounded-2xl motion-reduce:transition-none"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow:
              '0 0 0 3px rgba(45, 212, 191, 0.9), 0 0 24px rgba(45, 212, 191, 0.35), 0 0 0 9999px rgba(15, 18, 14, 0.78)',
          }}
        />
      )}
    </>
  );

  return createPortal(halo, document.body);
}
