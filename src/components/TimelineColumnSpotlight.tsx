import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { holeRectForTourTarget } from '../utils/spotlightStickyChrome';

const PAD = 8;
const AUTO_DISMISS_MS = 3200;

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
    const next = holeRectForTourTarget(el, PAD);
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
