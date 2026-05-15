import { useState } from 'react';
import { SegmentedButtonGroup } from '../components/ui/SegmentedButtonGroup';
import type { WorkspaceTab } from '../components/layout/FinanceWorkspaceShell';

const TABS: { id: WorkspaceTab; label: string; eyebrow: string; title: string; body: string }[] = [
  {
    id: 'past',
    label: 'Past months',
    eyebrow: 'History & export',
    title: 'Past months',
    body: 'Pick a month, recap, export CSV. The live month stays on Dashboard.',
  },
  {
    id: 'household',
    label: 'Your numbers',
    eyebrow: 'Household data',
    title: 'Your numbers',
    body: 'Income, essentials, loans — edits hit the dashboard the same minute.',
  },
  {
    id: 'plan',
    label: 'Plan & bills',
    eyebrow: 'Allocation & savings',
    title: 'Plan & bills',
    body: 'Split, envelopes, emergency, debt balances. Bill calendar stays on Dashboard.',
  },
];

export function DemoWorkspacePreview() {
  const [tab, setTab] = useState<WorkspaceTab>('household');
  const intro = TABS.find((t) => t.id === tab)!;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-moss-border dark:bg-moss-surface">
      <div className="border-b border-slate-200/90 bg-slate-100/95 px-2 py-2 dark:border-moss-border dark:bg-moss-elevated">
        <SegmentedButtonGroup
          aria-label="Workspace sections"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ id: t.id, label: t.label }))}
          size="frame"
          animatedIndicator
        />
      </div>

      <div className="border-b border-slate-200/80 bg-slate-50/90 px-3 py-4 dark:border-moss-border dark:bg-moss-surface/90">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300/90">
          {intro.eyebrow}
        </p>
        <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-moss-fg">{intro.title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-moss-subtle">{intro.body}</p>
      </div>

      <div className="space-y-2 p-3 text-sm">
        {tab === 'past' ? (
          <>
            <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 dark:border-moss-border dark:bg-moss-bg/80">
              Month picker · history banner · insights for April
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 dark:border-moss-border dark:bg-moss-bg/80">
              Income log &amp; monthly report · <strong>Export CSV</strong>
            </div>
          </>
        ) : null}
        {tab === 'household' ? (
          <ul className="space-y-2 text-slate-700 dark:text-moss-subtle">
            <li className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 dark:border-moss-border dark:bg-moss-bg/80">
              Combined pay: <strong>$8,000/mo</strong> · husband + wife schedules
            </li>
            <li className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 dark:border-moss-border dark:bg-moss-bg/80">
              Essentials: rent, power, internet · Card debt $2,400
            </li>
          </ul>
        ) : null}
        {tab === 'plan' ? (
          <ul className="space-y-2 text-slate-700 dark:text-moss-subtle">
            <li className="rounded-lg border border-teal-200/70 bg-teal-50/50 px-3 py-2 dark:border-teal-900/40 dark:bg-teal-950/25">
              Allocation pie · essentials / groceries / debt / savings
            </li>
            <li className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 dark:border-moss-border dark:bg-moss-bg/80">
              Fun-money wallets · emergency fund · savings goals
            </li>
          </ul>
        ) : null}
      </div>
    </section>
  );
}
