import { useEffect, useId, useState, type ReactNode } from 'react';
import { HoverTip } from './HoverTip';

export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  tip,
  delayMs = 0,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
  tip?: ReactNode;
  /** Stagger mount animation. */
  delayMs?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const targetOffset = c * (1 - v);

  const [offset, setOffset] = useState(c);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setOffset(targetOffset);
      setMounted(true);
      return;
    }
    const start = window.setTimeout(() => {
      setMounted(true);
      requestAnimationFrame(() => setOffset(targetOffset));
    }, delayMs);
    return () => window.clearTimeout(start);
  }, [targetOffset, delayMs, c]);

  const body = (
    <div
      className={`flex flex-col items-center gap-2 transition-all duration-500 ease-out ${
        mounted ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
      }`}
    >
      <div className="relative">
        <svg width={size} height={size} className="rotate-[-90deg] drop-shadow-sm">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(13 148 136)" />
              <stop offset="100%" stopColor="rgb(16 185 129)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-sage-200/90 dark:stroke-moss-border"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="ring-progress-stroke"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        {mounted && v > 0 ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-full ring-progress-glow"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-sage-900 dark:text-moss-fg">{label}</p>
        {sublabel && <p className="text-xs text-sage-600 dark:text-moss-muted">{sublabel}</p>}
      </div>
    </div>
  );

  if (tip) {
    return (
      <HoverTip content={tip} interaction="auto" layout="inline-end" className="w-auto">
        {body}
      </HoverTip>
    );
  }

  return body;
}
