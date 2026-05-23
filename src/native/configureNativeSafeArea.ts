import { Capacitor } from '@capacitor/core';

/** Android WebView often reports 0 for env(safe-area-inset-*); set CSS vars used by index.css. */
export function configureNativeSafeArea(): void {
  if (!Capacitor.isNativePlatform()) return;

  const measure = () => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;pointer-events:none;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    let top = parseFloat(style.paddingTop) || 0;
    let bottom = parseFloat(style.paddingBottom) || 0;
    probe.remove();

    if (Capacitor.getPlatform() === 'android') {
      if (top < 8) top = 32;
      if (bottom < 8) bottom = 28;
    }

    document.documentElement.style.setProperty('--cap-safe-top', `${top}px`);
    document.documentElement.style.setProperty('--cap-safe-bottom', `${bottom}px`);
  };

  if (document.body) measure();
  else document.addEventListener('DOMContentLoaded', measure, { once: true });

  window.visualViewport?.addEventListener('resize', measure);
  window.addEventListener('orientationchange', () => window.setTimeout(measure, 150));
}
