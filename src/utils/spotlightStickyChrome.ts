/**
 * Bottom edge of sticky top chrome (header + desktop primary tabs) in viewport px.
 * When `excludeTourTarget` lies inside `#finance-primary-tabs`, that strip is omitted so
 * spotlight holes around that strip are not clipped to a sliver.
 */
export function getStickyChromeBottomPx(opts?: { excludeTourTarget?: HTMLElement | null }): number {
  const ex = opts?.excludeTourTarget ?? null;
  let y = 0;
  const header = document.querySelector('header');
  const tabs = document.getElementById('finance-primary-tabs');
  if (header instanceof HTMLElement) y = Math.max(y, header.getBoundingClientRect().bottom);
  if (tabs instanceof HTMLElement) {
    const nr = tabs.getBoundingClientRect();
    if (nr.height > 2 && nr.width > 2) {
      const targetInsideTabs = Boolean(ex && tabs.contains(ex));
      if (!targetInsideTabs) y = Math.max(y, nr.bottom);
    }
  }
  return y;
}

/**
 * Viewport rect for a spotlight hole around `el`, padded and clipped below sticky chrome
 * (same rules as `TimelineColumnSpotlight`).
 */
export function holeRectForTourTarget(el: HTMLElement, pad: number): {
  top: number;
  left: number;
  width: number;
  height: number;
} | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 8 || r.height <= 8) return null;

  const chromeBottom = getStickyChromeBottomPx({ excludeTourTarget: el });
  let top = r.top - pad;
  let height = r.height + pad * 2;
  const left = r.left - pad;
  const width = r.width + pad * 2;

  if (chromeBottom > 1 && top < chromeBottom) {
    const eat = chromeBottom - top;
    top = chromeBottom;
    height = Math.max(56, height - eat);
  }

  const vh = typeof window !== 'undefined' ? window.innerHeight : height;
  if (top + height > vh) {
    height = Math.max(48, vh - top - pad);
  }

  if (height < 40 || width < 40) return null;

  return { top, left, width, height };
}
