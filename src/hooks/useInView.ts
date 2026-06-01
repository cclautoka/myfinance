import { useEffect, useRef, useState } from 'react';

/** True once element intersects viewport (one-shot). */
export function useInView(options?: { rootMargin?: string; threshold?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      {
        rootMargin: options?.rootMargin ?? '0px 0px -5% 0px',
        threshold: options?.threshold ?? 0.12,
      },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, inView };
}
