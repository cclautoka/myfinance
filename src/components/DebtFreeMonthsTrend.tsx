import type { DebtFreeMonthsTrendKind } from '../utils/debtFree';
import type { ReactNode } from 'react';
import { HoverTip } from './ui/HoverTip';

function TrendIcon({ kind }: { kind: DebtFreeMonthsTrendKind }) {
  if (kind === 'worse') {
    return (
      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
        <path
          d="M6 2.5 9.5 7H2.5L6 2.5Z"
          fill="currentColor"
          className="drop-shadow-[0_0_4px_rgba(244,63,94,0.55)]"
        />
      </svg>
    );
  }
  if (kind === 'better') {
    return (
      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
        <path
          d="M6 9.5 2.5 5h7L6 9.5Z"
          fill="currentColor"
          className="drop-shadow-[0_0_4px_rgba(16,185,129,0.55)]"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden>
      <path d="M2.5 6h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SHELL_CLASS: Record<DebtFreeMonthsTrendKind, string> = {
  unknown:
    'border-sky-300/80 bg-gradient-to-b from-sky-50 to-sky-100/90 text-sky-700 shadow-[0_0_12px_rgba(56,189,248,0.25)] dark:border-sky-500/35 dark:from-sky-950/50 dark:to-sky-900/30 dark:text-sky-200',
  worse:
    'border-rose-300/90 bg-gradient-to-b from-rose-50 to-rose-100/95 text-rose-700 shadow-[0_0_14px_rgba(244,63,94,0.35)] dark:border-rose-500/40 dark:from-rose-950/55 dark:to-rose-900/35 dark:text-rose-200',
  better:
    'border-emerald-300/90 bg-gradient-to-b from-emerald-50 to-emerald-100/95 text-emerald-700 shadow-[0_0_14px_rgba(16,185,129,0.35)] dark:border-emerald-500/40 dark:from-emerald-950/55 dark:to-emerald-900/35 dark:text-emerald-200',
  unchanged:
    'border-slate-300/70 bg-gradient-to-b from-slate-50 to-slate-100/90 text-slate-500 shadow-[0_0_10px_rgba(148,163,184,0.2)] dark:border-moss-border dark:from-moss-surface dark:to-moss-bg dark:text-moss-muted',
};

export function DebtFreeMonthsTrend({
  kind,
  tip,
}: {
  kind: DebtFreeMonthsTrendKind;
  tip: ReactNode;
}) {
  return (
    <HoverTip content={tip} layout="wrap">
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-300 hover:scale-110 ${SHELL_CLASS[kind]}`}
        aria-label="Debt-free trend vs last month open"
      >
        <TrendIcon kind={kind} />
      </span>
    </HoverTip>
  );
}
