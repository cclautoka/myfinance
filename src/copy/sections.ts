/** Page-level titles and subtitles (Dashboard, Workspace, Tools). */

export const sections = {
  dashboard: {
    title: 'Dashboard',
    eyebrow: 'Live month',
    subtitle:
      'This month at a glance: snapshot and pay log in the centre, bills on the sides, and more under “More this month”.',
  },
  workspace: {
    title: 'Workspace',
    subtitle: 'Edit your plan, review past months, and adjust savings goals.',
  },
  tools: {
    title: 'Tools',
    subtitle: 'Sign-in, email alerts, and household settings.',
  },
  header: {
    workspaceTitle: 'Household workspace',
    workspaceSubtitle:
      'Dashboard for this month. Workspace for history and your plan. Tools for alerts and account settings.',
  },
  moreThisMonth: {
    summary: 'More this month',
  },
  workspaceTabs: {
    past: {
      eyebrow: 'History & export',
      title: 'Past months',
      body: 'Pick a month, review the recap, or export CSV.',
      details: 'The live month stays on the Dashboard tab.',
    },
    household: {
      eyebrow: 'Household data',
      title: 'Your numbers',
      body: 'Income, essentials, and loans. Edits update the Dashboard straight away.',
      details: 'Open when you need to tune the workbook.',
    },
    plan: {
      eyebrow: 'Allocation & savings',
      title: 'Plan & bills',
      body: 'Split, envelopes, emergency fund, and debt balances.',
      details: 'The bill calendar stays on the Dashboard tab.',
    },
  },
} as const;
