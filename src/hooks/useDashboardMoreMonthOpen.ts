import { useCallback, useEffect, useState, useSyncExternalStore, type SyntheticEvent } from 'react';

const MQ = '(max-width: 1023px)';

function subscribeMobile(callback: () => void) {
  const mq = window.matchMedia(MQ);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getMobileDefaultOpen() {
  return window.matchMedia(MQ).matches;
}

/** On phone/tablet, “More this month” (snowball & surplus) starts expanded so charts are visible without an extra tap. */
export function useDashboardMoreMonthOpen() {
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileDefaultOpen, () => false);
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? getMobileDefaultOpen() : false,
  );

  useEffect(() => {
    if (isMobile) setOpen(true);
  }, [isMobile]);

  const onToggle = useCallback((e: SyntheticEvent<HTMLDetailsElement>) => {
    const next = e.currentTarget.open;
    setOpen(next);
    if (next) {
      e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  return { open, setOpen, onToggle };
}
