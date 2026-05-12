export const ONBOARDING_STORAGE_KEY = 'finance-onboarding-tour-done-v7';

export type TourStepSpec = {
  target: string;
  title: string;
  body: string;
  /** How to scroll the target into view (sticky bars work better with `start` / `nearest`). */
  scrollBlock?: 'start' | 'center' | 'nearest';
};

export const ONBOARDING_STEPS: TourStepSpec[] = [
  {
    target: 'tour-dashboard',
    title: 'Current month overview',
    body: 'Three columns: upcoming bills, snapshot + pay log + extra cash, bill checklist. Unused plan room can be swept into emergency; surprises log just below this band.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-nav-shortcuts',
    title: 'Section shortcuts',
    body: 'On your phone, use the bottom bar: Home, Shocks, Tips, and More for worksheets. On a wide screen, the sticky pill row under the header does the same — Dashboard, surprises, Guidance, and workspace tabs.',
    scrollBlock: 'nearest',
  },
  {
    target: 'tour-surprise-log',
    title: 'Unexpected expenses',
    body: 'One-off costs live here in their own band — easy to reach right under the dashboard.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-guidance',
    title: 'Plain-English guidance',
    body: 'Auto-generated nudges from your inputs — not hidden at the bottom anymore. Still not professional advice.',
    scrollBlock: 'start',
  },
  {
    target: 'tour-workspace',
    title: 'Past months & planners',
    body: 'Tabs for archived months (picker, recap, CSV), income & bills in Your numbers, plan tools, and tools / alerts / reset. Open a tab with quick nav or tap here.',
    scrollBlock: 'start',
  },
];
