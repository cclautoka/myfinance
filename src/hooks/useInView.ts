import { useEffect, useRef, useState } from 'react';

export type UseInViewOptions = {
  rootMargin?: string;
  threshold?: number;
  /** When true, do not reveal until the user has scrolled or the element started below the fold. */
  animateOnlyAfterScroll?: boolean;
};

/** True once element intersects viewport (one-shot). */
export function useInView(options?: UseInViewOptions) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  const rootMargin = options?.rootMargin;
  const threshold = options?.threshold;
  const animateOnlyAfterScroll = options?.animateOnlyAfterScroll ?? false;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setInView(true);
      return;
    }

    let userHasScrolled = false;
    const startedBelowFold = el.getBoundingClientRect().top > window.innerHeight * 0.92;

    const markScrolled = () => {
      userHasScrolled = true;
    };
    window.addEventListener('scroll', markScrolled, { passive: true, capture: true });
    window.addEventListener('wheel', markScrolled, { passive: true });
    window.addEventListener('touchmove', markScrolled, { passive: true });

    const shouldReveal = () => {
      if (!animateOnlyAfterScroll) return true;
      return userHasScrolled || startedBelowFold;
    };

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && shouldReveal()) {
          setInView(true);
          obs.disconnect();
        }
      },
      {
        rootMargin: rootMargin ?? '0px 0px -5% 0px',
        threshold: threshold ?? 0.12,
      },
    );
    obs.observe(el);

    return () => {
      obs.disconnect();
      window.removeEventListener('scroll', markScrolled, true);
      window.removeEventListener('wheel', markScrolled);
      window.removeEventListener('touchmove', markScrolled);
    };
  }, [rootMargin, threshold, animateOnlyAfterScroll]);

  return { ref, inView };
}
