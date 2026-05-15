/** Bumped so existing users see updated tour copy for Dashboard / Workspace / Tools navigation. */
export const ONBOARDING_STORAGE_KEY = 'finance-onboarding-tour-done-v10';

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
    title: 'This month at a glance',
    body: 'Planned income, pocket left, and pay log — the centre column is your month’s truth.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-bills-checklist',
    title: 'Bills checklist',
    body: 'Check off lines when money actually left the account — plan vs actual stays visible.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-pay-log',
    title: 'Pay log & pocket left',
    body: 'Logged deposits and extras roll into “pocket left” so you always know what’s still spendable.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-nav-shortcuts',
    title: 'Move around quickly',
    body: 'Use Dashboard, Workspace, and Tools — bottom bar on your phone; tabs under the header on larger screens.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-workspace',
    title: 'Adjust the numbers',
    body: 'Past months, household inputs, and plan & savings — open a workspace tab when you need to edit.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-tools-notify',
    title: 'Tools & alerts',
    body: 'Notification emails, server sign-in, invites, and reset — set early if you rely on email heads-up.',
    scrollBlock: 'start',
  },
];

const TOUR_TOOLS_SIGNED_IN =
  'Notification emails, server sign-in, magic email links, partner invites, pairing codes, API keys, and test mail — sync this device with your relay when you are ready.';

const TOUR_TOOLS_LOCAL =
  'Notification emails, magic sign-in links once the relay is set, and a local relay URL — data stays in the browser until you connect a server and sign in.';

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
