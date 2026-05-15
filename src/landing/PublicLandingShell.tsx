import { lazy, Suspense, useEffect, useState } from 'react';
import { HouseholdAuthForm } from '../auth/HouseholdAuthForm';
import { defaultFinanceState } from '../data/defaults';
import type { ThemePreference } from '../types/finance';
import { bootstrapPublicApiConfig } from '../utils/publicApiBootstrap';
import { LandingDemoSkeleton } from './LandingDemoSkeleton';

const ProductDemoPlayer = lazy(() =>
  import('./ProductDemoPlayer').then((m) => ({ default: m.ProductDemoPlayer })),
);

function applyThemeClass(theme: ThemePreference) {
  const root = document.documentElement;
  const setDark = (on: boolean) => {
    if (on) root.classList.add('dark');
    else root.classList.remove('dark');
  };
  if (theme === 'dark') setDark(true);
  else if (theme === 'light') setDark(false);
  else setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function PublicLandingShell() {
  const [theme, setTheme] = useState<ThemePreference>(() => defaultFinanceState().theme);

  useEffect(() => {
    bootstrapPublicApiConfig();
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeClass('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!(meta instanceof HTMLMetaElement)) return;
    const light = '#f4f7fb';
    const dark = '#050506';
    const sync = () => {
      meta.content = document.documentElement.classList.contains('dark') ? dark : light;
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-svh bg-gradient-to-br from-teal-50/90 via-[#f4f7fb] to-slate-100 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg">
      <div className="mx-auto flex min-h-svh w-full max-w-[96rem] flex-col lg:flex-row">
        <section className="min-h-[42vh] flex-1 border-b border-slate-200/80 p-4 sm:p-6 lg:min-h-svh lg:w-[60%] lg:border-b-0 lg:border-r lg:p-8 xl:p-10">
          <Suspense fallback={<LandingDemoSkeleton />}>
            <ProductDemoPlayer />
          </Suspense>
        </section>
        <aside className="flex w-full shrink-0 flex-col justify-center p-4 sm:p-6 lg:w-[40%] lg:min-w-[280px] lg:p-6 xl:p-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white/85 p-4 shadow-sm backdrop-blur-sm dark:border-moss-border dark:bg-moss-surface/90 sm:p-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            <HouseholdAuthForm theme={theme} onTheme={setTheme} variant="embedded" />
          </div>
        </aside>
      </div>
    </div>
  );
}
