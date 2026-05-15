import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { DemoToolsPreview } from './DemoToolsPreview';
import { DemoWorkspacePreview } from './DemoWorkspacePreview';
import { LandingDashboardDemo } from './LandingDashboardDemo';
import { SegmentedButtonGroup } from '../components/ui/SegmentedButtonGroup';
import type { AppTab } from '../components/layout/AppPrimaryTabs';
import { DemoScaledViewport } from './DemoScaledViewport';
import { DemoSlideTransition, type SlideDirection } from './DemoSlideTransition';
import { useDemoSlideAutoplay } from './useDemoSlideAutoplay';
import { useMinMdViewport } from './useMinMdViewport';

const DEMO_TABS: { id: AppTab; label: string; blurb: string }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    blurb: 'Upcoming bills, bill calendar checkmarks, financial snapshot, and “More this month” for pay & charts.',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    blurb: 'Past months & CSV export, your household numbers, and plan & savings — three workspace tabs.',
  },
  {
    id: 'tools',
    label: 'Tools',
    blurb: 'Household sign-in, notify relay, magic links, invites, and worksheet reset.',
  },
];

const DESIGN_WIDTH = { desktop: 640, mobile: 360 } as const;

function tabIndex(tab: AppTab) {
  return DEMO_TABS.findIndex((t) => t.id === tab);
}

function DemoPanel({ appTab }: { appTab: AppTab }) {
  if (appTab === 'dashboard') {
    return (
      <div className="demo-content-breathe p-2">
        <LandingDashboardDemo />
      </div>
    );
  }
  if (appTab === 'workspace') {
    return (
      <div className="p-2">
        <DemoWorkspacePreview />
      </div>
    );
  }
  return (
    <div className="p-2">
      <DemoToolsPreview />
    </div>
  );
}

function SlideshowChrome({
  step,
  slideProgress,
  paused,
  onSelect,
}: {
  step: number;
  slideProgress: number;
  paused: boolean;
  onSelect: (index: number) => void;
}) {
  const tab = DEMO_TABS[step]!;
  const pct = Math.round(slideProgress * 100);

  return (
    <div className="mb-4 shrink-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-800 dark:text-teal-300/90">
          Live product tour
        </p>
        <p className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-moss-muted" aria-live="polite">
          {step + 1} / {DEMO_TABS.length} · {tab.label}
        </p>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-slate-200/90 dark:bg-moss-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={paused ? undefined : pct}
        aria-label={`Slide ${step + 1} progress`}
      >
        <div
          className={`h-full origin-left rounded-full bg-teal-600 transition-[width] duration-150 ease-linear dark:bg-teal-500 ${paused ? 'opacity-70' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Demo slides">
        {DEMO_TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === step}
            aria-label={`${t.label}: ${t.blurb}`}
            onClick={() => onSelect(i)}
            className={`h-2.5 flex-1 rounded-full transition-all duration-300 ${
              i === step
                ? 'bg-teal-600 shadow-sm ring-2 ring-teal-500/30 dark:bg-teal-500'
                : 'bg-slate-300/80 hover:bg-slate-400/90 dark:bg-moss-border dark:hover:bg-moss-muted/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function DeviceFrame({
  variant,
  appTab,
  slideDirection,
  scrollRef,
  onAppTabChange,
  className = '',
}: {
  variant: 'desktop' | 'mobile';
  appTab: AppTab;
  slideDirection: SlideDirection;
  scrollRef: RefObject<HTMLDivElement | null>;
  onAppTabChange: (t: AppTab) => void;
  className?: string;
}) {
  const isMobile = variant === 'mobile';
  const designWidth = isMobile ? DESIGN_WIDTH.mobile : DESIGN_WIDTH.desktop;

  return (
    <div className={`transition-all duration-300 ${className}`}>
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-moss-muted">
        {isMobile ? 'Mobile' : 'Desktop'}
      </p>
      <div
        className={`overflow-hidden shadow-xl ring-2 ring-teal-500/25 transition-shadow duration-300 dark:ring-teal-400/20 ${
          isMobile
            ? 'rounded-[1.75rem] border-[3px] border-slate-800 bg-slate-900 p-1.5 dark:border-slate-600'
            : 'rounded-xl border-2 border-slate-200/90 bg-slate-100 dark:border-moss-border dark:bg-moss-bg'
        }`}
      >
        {isMobile ? <div className="mx-auto mb-1 h-1 w-12 rounded-full bg-slate-700" aria-hidden /> : null}
        <div
          className={
            isMobile
              ? 'flex max-h-[min(52vh,420px)] min-h-[280px] flex-col overflow-hidden rounded-[1.25rem] bg-[#f4f7fb] dark:bg-[#050506]'
              : 'flex max-h-[min(56vh,480px)] min-h-[280px] flex-col overflow-hidden rounded-lg bg-[#f4f7fb] dark:bg-[#050506]'
          }
        >
          <div className="shrink-0 border-b border-slate-200/80 bg-white/95 px-2 py-2 dark:border-moss-border dark:bg-moss-surface/95">
            <p className="truncate text-center text-[10px] font-bold text-teal-900 dark:text-teal-200">Solofi Finance</p>
            <div className="mt-1.5">
              <SegmentedButtonGroup
                aria-label="Demo app section"
                value={appTab}
                onChange={onAppTabChange}
                options={DEMO_TABS.map((t) => ({ id: t.id, label: t.label }))}
                size="frame"
                animatedIndicator
              />
            </div>
          </div>
          <div
            ref={scrollRef}
            className="scrollbar-app min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          >
            <DemoScaledViewport designWidth={designWidth}>
              <DemoSlideTransition activeKey={appTab} direction={slideDirection}>
                <DemoPanel appTab={appTab} />
              </DemoSlideTransition>
            </DemoScaledViewport>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductDemoPlayer() {
  const isDesktop = useMinMdViewport();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [appTab, setAppTab] = useState<AppTab>('dashboard');
  const [step, setStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('left');
  const [paused, setPaused] = useState(false);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const selectTab = useCallback((index: number, direction?: SlideDirection) => {
    const next = DEMO_TABS[index];
    if (!next) return;
    const prev = stepRef.current;
    const dir =
      direction ??
      (index > prev || (prev === DEMO_TABS.length - 1 && index === 0) ? 'left' : 'right');
    setSlideDirection(dir);
    setStep(index);
    setAppTab(next.id);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const advanceSlide = useCallback(() => {
    const next = (stepRef.current + 1) % DEMO_TABS.length;
    selectTab(next, 'left');
  }, [selectTab]);

  const slideProgress = useDemoSlideAutoplay({
    scrollRef,
    slideKey: `${appTab}-${isDesktop ? 'desktop' : 'mobile'}`,
    paused,
    onAdvance: advanceSlide,
  });

  const blurb = DEMO_TABS[step]?.blurb ?? '';

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="mb-3 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal-800 dark:text-teal-300/90">
          How it works
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-moss-fg sm:text-3xl">
          Your household money, one calm dashboard
        </h1>
        <p key={step} className="demo-blurb-enter mt-2 max-w-2xl text-sm text-slate-600 dark:text-moss-muted">
          {blurb}
        </p>
      </div>

      <SlideshowChrome step={step} slideProgress={slideProgress} paused={paused} onSelect={selectTab} />

      <DeviceFrame
        variant={isDesktop ? 'desktop' : 'mobile'}
        appTab={appTab}
        slideDirection={slideDirection}
        scrollRef={scrollRef}
        onAppTabChange={(t) => selectTab(tabIndex(t))}
        className={isDesktop ? 'min-w-0 flex-1' : 'mx-auto w-full max-w-[min(100%,320px)]'}
      />
    </div>
  );
}
