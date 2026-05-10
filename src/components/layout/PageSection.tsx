import type { ReactNode } from 'react';
import { SECTION_PALETTE, type SectionAccent } from './sectionAccents';

type Variant = 'plain' | 'band' | 'spotlight';

/**
 * Landmark section — anchors match FinanceQuickNav ids.
 * `band` / `spotlight` use gradient headers + tinted frames (`accent` picks the hue family).
 */
export function PageSection({
  id,
  title,
  subtitle,
  variant = 'plain',
  accent,
  eyebrow,
  dataTour,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  variant?: Variant;
  /** Hue for band/spotlight frames and gradient header — defaults teal (spotlight) or emerald (band). */
  accent?: SectionAccent;
  /** Small uppercase label on the gradient strip (recommended for band/spotlight). */
  eyebrow?: string;
  /** Target for the onboarding spotlight (`data-tour` on the section). */
  dataTour?: string;
  children: ReactNode;
}) {
  const resolvedAccent: SectionAccent | null =
    variant === 'plain' ? null : accent ?? (variant === 'spotlight' ? 'teal' : 'emerald');
  const palette = resolvedAccent ? SECTION_PALETTE[resolvedAccent] : null;

  const shell =
    variant === 'plain'
      ? ''
      : variant === 'spotlight'
        ? palette!.spotlightShell
        : palette!.bandShell;

  const headerPlain = (
    <>
      <h2 className="font-display text-3xl font-bold tracking-tight text-sage-900 dark:text-moss-fg sm:text-[2rem]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">{subtitle}</p>
      )}
    </>
  );

  const defaultEyebrow = variant === 'spotlight' ? 'Read this' : 'Overview';
  const headerEyebrow = eyebrow ?? defaultEyebrow;

  const headerHero =
    palette && (
      <>
        <p className={`text-[11px] font-bold uppercase tracking-[0.28em] ${palette.eyebrowOnHeader}`}>{headerEyebrow}</p>
        <h2 className={`mt-2 font-display text-3xl font-bold tracking-tight sm:text-[2.35rem] ${palette.titleOnHeader}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-3 max-w-2xl text-base font-medium leading-relaxed ${palette.subtitleOnHeader}`}>
            {subtitle}
          </p>
        )}
      </>
    );

  return (
    <section id={id} data-tour={dataTour} className={`scroll-mt-40 sm:scroll-mt-36 ${shell}`}>
      {variant !== 'plain' && palette ? (
        <>
          <header
            className={`-mx-5 -mt-10 mb-8 rounded-b-3xl px-7 py-8 shadow-inner sm:-mx-8 sm:-mt-10 sm:px-10 ${palette.headerGradient}`}
            aria-live="polite"
          >
            {headerHero}
          </header>
          <div className="min-w-0 space-y-8">{children}</div>
        </>
      ) : (
        <>
          <header className="mb-8 max-w-3xl border-b-2 border-sage-200/90 pb-6 dark:border-moss-border">{headerPlain}</header>
          <div className="min-w-0 space-y-8">{children}</div>
        </>
      )}
    </section>
  );
}
