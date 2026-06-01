import type { ReactNode } from 'react';
import { InfoIcon } from './InfoIcon';

/** Short hint line with a real info icon (replaces “Tap i” in prose). */
export function HintWithInfo({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 text-center text-sm leading-relaxed text-sage-100/95 dark:text-moss-subtle ${className}`}
    >
      <InfoIcon className="h-4 w-4 text-teal-200/90 dark:text-teal-300/85" />
      <span>{children}</span>
    </p>
  );
}
