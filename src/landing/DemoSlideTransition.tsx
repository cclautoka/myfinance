import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppTab } from '../components/layout/AppPrimaryTabs';

export type SlideDirection = 'left' | 'right';

type Layer = { key: AppTab; node: ReactNode };

type DemoSlideTransitionProps = {
  activeKey: AppTab;
  direction: SlideDirection;
  children: ReactNode;
  className?: string;
};

const EXIT_MS = 350;

function slideInClass(direction: SlideDirection) {
  return direction === 'left' ? 'demo-slide-in-from-right' : 'demo-slide-in-from-left';
}

function slideOutClass(direction: SlideDirection) {
  return direction === 'left' ? 'demo-slide-out-to-left' : 'demo-slide-out-to-right';
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export function DemoSlideTransition({ activeKey, direction, children, className = '' }: DemoSlideTransitionProps) {
  const reducedMotion = usePrefersReducedMotion();
  const layerRef = useRef<Layer>({ key: activeKey, node: children });
  const [displayed, setDisplayed] = useState<Layer>(() => ({ key: activeKey, node: children }));
  const [exiting, setExiting] = useState<Layer | null>(null);
  const [exitDirection, setExitDirection] = useState<SlideDirection>(direction);

  useEffect(() => {
    const prev = layerRef.current;
    if (prev.key === activeKey) {
      const next = { key: activeKey, node: children };
      layerRef.current = next;
      setDisplayed(next);
      return;
    }

    if (reducedMotion) {
      const next = { key: activeKey, node: children };
      layerRef.current = next;
      setDisplayed(next);
      setExiting(null);
      return;
    }

    setExiting(prev);
    setExitDirection(direction === 'left' ? 'right' : 'left');
    const next = { key: activeKey, node: children };
    layerRef.current = next;
    setDisplayed(next);

    const id = window.setTimeout(() => setExiting(null), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [activeKey, children, direction, reducedMotion]);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {exiting ? (
        <div
          key={`exit-${exiting.key}`}
          className={`demo-slide-layer pointer-events-none absolute inset-x-0 top-0 z-0 ${slideOutClass(exitDirection)}`}
          aria-hidden
        >
          {exiting.node}
        </div>
      ) : null}
      <div key={`enter-${displayed.key}`} className={`demo-slide-layer relative z-10 ${slideInClass(direction)}`}>
        {displayed.node}
      </div>
    </div>
  );
}
