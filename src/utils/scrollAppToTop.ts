const scrollBehavior = (): ScrollBehavior => ('instant' in window ? 'instant' : 'auto');

/** Scroll the document (and Capacitor WebView scroll roots) to the top. */
export function scrollAppToTop(): void {
  const scrolling = document.scrollingElement;
  if (scrolling instanceof HTMLElement) {
    scrolling.scrollTop = 0;
    scrolling.scrollLeft = 0;
  }

  const roots: Element[] = [document.documentElement, document.body];
  const root = document.getElementById('root');
  if (root) roots.push(root);
  const shell = document.querySelector('.cap-app-shell');
  if (shell) roots.push(shell);

  for (const el of roots) {
    if (!(el instanceof HTMLElement)) continue;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }

  window.scrollTo({ top: 0, left: 0, behavior: scrollBehavior() });

  document.getElementById('finance-dashboard')?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  document.getElementById('app-tabpanel-dashboard')?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
}

/** Native tab switches: layout + paint can restore scroll; retry briefly. */
export function scrollAppToTopAfterTabChange(): void {
  scrollAppToTop();
  requestAnimationFrame(scrollAppToTop);
  window.setTimeout(scrollAppToTop, 0);
  window.setTimeout(scrollAppToTop, 50);
  window.setTimeout(scrollAppToTop, 150);
  window.setTimeout(scrollAppToTop, 300);
}
