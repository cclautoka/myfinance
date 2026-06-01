/** Bumped so existing users see updated tour copy for Dashboard / Workspace / Tools navigation. */
export const ONBOARDING_STORAGE_KEY = 'finance-onboarding-tour-done-v13';

/** Set when user picks “Remind me later” so the shell can offer to reopen the tour. */
export const ONBOARDING_TOUR_LATER_KEY = 'finance-onboarding-tour-later-v1';

export type TourStepSpec = {
  target: string;
  title: string;
  body: string;
  /** How to scroll the target into view (sticky bars work better with `start` / `nearest`). */
  scrollBlock?: 'start' | 'center' | 'nearest';
};

export const ONBOARDING_STEPS: TourStepSpec[] = [
  {
    target: 'tour-dashboard-snapshot',
    title: 'Financial snapshot',
    body: 'On desktop this sits in the centre: planned income, left from deposits, carry-over, deposits, and savings rings. A lifetime chart is just below.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-bills-checklist',
    title: 'Bill calendar',
    body: 'On the right on desktop (below the snapshot on phone): enter what you paid, then mark as paid. Plan vs actual stays on each line.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-pay-log',
    title: 'Paycheque log',
    body: 'Always on the Dashboard under the snapshot. Log each deposit and tag Husband, Wife, or Joint. Totals match Deposits this month above.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-nav-shortcuts',
    title: 'Dashboard · Workspace · Tools',
    body: 'Switch main tabs here (bottom bar on phone). Workspace has Past months, Your numbers, and Plan and bills.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-workspace',
    title: 'Workspace sections',
    body: 'Past months for history and CSV export. Your numbers for income, essentials, and debts. Plan and bills for allocation and savings.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-tools-notify',
    title: 'Tools and alerts',
    body: 'Household sign-in, email alerts, magic links, invites, and API keys. Set these up early if you rely on save notifications.',
    scrollBlock: 'start',
  },
];

const TOUR_TOOLS_SIGNED_IN =
  'Household and sync: notification emails, server reload, magic email links, partner invites, pairing codes, API keys, and test mail.';

const TOUR_TOOLS_LOCAL =
  'Household and sync: notification emails and relay URL on this device. Sign in to enable server backup and magic links.';

/** Same targets/order as {@link ONBOARDING_STEPS}; last step copy depends on relay session. */
export function onboardingStepsForContext(opts: { householdSignedIn: boolean }): TourStepSpec[] {
  const steps = [...ONBOARDING_STEPS];
  const last = steps.length - 1;
  steps[last] = {
    ...steps[last],
    body: opts.householdSignedIn ? TOUR_TOOLS_SIGNED_IN : TOUR_TOOLS_LOCAL,
  };
  return steps;
}
