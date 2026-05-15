/** Bumped so existing users see updated tour copy for Dashboard / Workspace / Tools navigation. */
export const ONBOARDING_STORAGE_KEY = 'finance-onboarding-tour-done-v11';

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
    body: 'Centre column on desktop: planned income, pocket left, deposits, and emergency/debt rings. A lifetime pay chart sits just below.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-bills-checklist',
    title: 'Bill calendar & checkmarks',
    body: 'Right column (below snapshot on phone): mark bills handled with the real amount paid — plan vs actual stays on each line.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-pay-log',
    title: 'More this month',
    body: 'Open this accordion for debt snowball, budget surplus, and the paycheque log — same block as the landing demo.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-nav-shortcuts',
    title: 'Dashboard · Workspace · Tools',
    body: 'Switch main tabs here (bottom bar on phone). Workspace has Past months, Your numbers, and Plan & bills inside.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-workspace',
    title: 'Workspace sections',
    body: 'Past months for history & CSV export, Your numbers for income/essentials/debts, Plan & bills for allocation and savings.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-tools-notify',
    title: 'Tools & alerts',
    body: 'Household sign-in, notify relay, magic links, invites, pairing codes, and API keys — set early if you rely on email heads-up.',
    scrollBlock: 'start',
  },
];

const TOUR_TOOLS_SIGNED_IN =
  'Household & sync: notification emails, server reload, magic email links, partner invites, pairing codes, API keys, and test mail.';

const TOUR_TOOLS_LOCAL =
  'Household & sync: notification emails and relay URL on this device — sign in to enable server backup and magic links.';

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
