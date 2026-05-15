import { useEffect, useRef, useState, type ReactNode } from 'react';

type DemoScaledViewportProps = {
  designWidth: number;
  children: ReactNode;
  className?: string;
};

/**
 * Renders children at a fixed design width, then scales down to fit the clip box.
 * Prevents horizontal overflow inside device mocks on the landing page.
 */
export function DemoScaledViewport({ designWidth, children, className = '' }: DemoScaledViewportProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const clip = clipRef.current;
    const inner = innerRef.current;
    if (!clip || !inner) return;

    const measure = () => {
      const clipWidth = clip.clientWidth;
      if (clipWidth <= 0) return;
      const nextScale = Math.min(1, clipWidth / designWidth);
      setScale(nextScale);
      setScaledHeight(inner.scrollHeight * nextScale);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(clip);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [designWidth, children]);

  return (
    <div ref={clipRef} className={`w-full overflow-hidden ${className}`} style={{ height: scaledHeight }}>
      <div
        ref={innerRef}
        style={{
          width: designWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
