import type { ReactNode } from 'react';
import { HoverTip } from './HoverTip';

export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  tip,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
  tip?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const offset = c * (1 - v);

  const body = (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-sage-200 dark:stroke-moss-border"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-teal-600 transition-all duration-700 ease-out dark:stroke-moss-accent-hover"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-sage-900 dark:text-moss-fg">{label}</p>
        {sublabel && <p className="text-xs text-sage-600 dark:text-moss-muted">{sublabel}</p>}
        {tip && (
          <p className="mt-1 text-[10px] text-sage-500 dark:text-moss-muted">Hover ring for details</p>
        )}
      </div>
    </div>
  );

  if (tip) {
    return (
      <HoverTip content={tip} className="flex flex-col items-center">
        {body}
      </HoverTip>
    );
  }

  return body;
}
