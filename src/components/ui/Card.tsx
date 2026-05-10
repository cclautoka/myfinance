import type { ReactNode } from 'react';
import { cardAccentTone, type SectionAccent } from '../layout/sectionAccents';

export function Card({
  children,
  className = '',
  title,
  subtitle,
  accent,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  /** Top stripe + subtle wash — matches section accent hues. */
  accent?: SectionAccent;
}) {
  const toneClass = accent ? cardAccentTone[accent] : '';
  return (
    <section
      className={`min-h-0 w-full max-w-full overflow-hidden rounded-2xl border border-sage-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md dark:border-moss-border dark:bg-moss-elevated ${toneClass} ${className}`}
    >
      {(title || subtitle) && (
        <header className="mb-4">
          {title && (
            <h2 className="font-display text-lg font-semibold tracking-tight text-sage-900 dark:text-moss-fg">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">{subtitle}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
