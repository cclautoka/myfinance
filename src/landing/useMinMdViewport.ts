import { useEffect, useState } from 'react';

/** True when viewport is md breakpoint or wider (768px+). */
export function useMinMdViewport() {
  const [minMd, setMinMd] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setMinMd(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return minMd;
}
