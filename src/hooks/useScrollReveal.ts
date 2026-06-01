import { useEffect, useRef, useState } from 'react';

/** Reveal element once when it enters the viewport (disabled when user prefers reduced motion). */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(options?: { rootMargin?: string }) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: options?.rootMargin ?? '0px 0px -8% 0px', threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options?.rootMargin]);

  return { ref, visible, className: `app-scroll-reveal${visible ? ' is-visible' : ''}` };
}
