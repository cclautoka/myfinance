import type { FinanceState } from '../types/finance';
import { advisorTip } from '../copy/tooltips';
import { buildAdvisorMessages } from '../utils/advisor';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';

const toneBorder = {
  calm: 'border-moss-border dark:bg-moss-surface/80',
  celebrate: 'border-sage-300/70 dark:border-moss-accent/30 dark:bg-moss-bg',
  'heads-up': 'border-sage-400/80 dark:border-amber-900/25 dark:bg-moss-surface',
} as const;

export function AdvisorPanel({
  state,
  prominent,
}: {
  state: FinanceState;
  /** Omit Card chrome — caller shows section header (dashboard-style band). */
  prominent?: boolean;
}) {
  const msgs = buildAdvisorMessages(state);

  const cardSubtitle =
    'Auto-generated sentences from your numbers — not a person, not financial advice. Hover any card to re-read.';

  const inner = (
    <>
      <HoverTip content={advisorTip()}>
        <p
          className={`cursor-default rounded-xl border-2 border-dashed px-3 py-2 text-xs font-semibold dark:border-moss-border ${
            prominent
              ? 'mb-8 border-teal-800/35 bg-teal-950/20 text-teal-100 dark:border-teal-500/35 dark:bg-moss-bg/50 dark:text-moss-subtle'
              : 'mb-5 border-sage-400/70 dark:border-moss-border'
          }`}
        >
          <span className={prominent ? 'text-teal-100/95 dark:text-moss-subtle' : 'text-sage-800 dark:text-moss-subtle'}>
            What this strip is — read once: these lines are shorthand from your workbook, not a chatbot or adviser.
          </span>
        </p>
      </HoverTip>
      <div className={`grid gap-4 ${prominent ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
        {msgs.map((m) => (
          <HoverTip
            key={m.id}
            content={
              <>
                <span className="font-semibold text-sage-900 dark:text-moss-tip">{m.title}</span>
                <p className="mt-1">{m.body}</p>
              </>
            }
          >
            <article
              className={`cursor-default rounded-2xl border bg-white/90 shadow-md dark:bg-moss-elevated ${toneBorder[m.tone]} ${
                prominent ? 'p-5' : 'p-4'
              }`}
            >
              <h3 className="font-display text-base font-semibold text-sage-900 dark:text-moss-fg">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sage-700 dark:text-moss-subtle">{m.body}</p>
            </article>
          </HoverTip>
        ))}
      </div>
    </>
  );

  if (prominent) return inner;

  return (
    <Card accent="teal" title="Plain-English nudges" subtitle={cardSubtitle}>
      {inner}
    </Card>
  );
}
