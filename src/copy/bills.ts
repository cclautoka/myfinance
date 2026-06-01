import { glossary } from './glossary';

export const bills = {
  calendarTitle: glossary.billCalendar,
  calendarSubtitle:
    'Enter what you actually paid, then mark as paid. We compare plan vs actual on each line. This app does not pay bills for you.',

  upcomingTitle: 'Next bills',
  upcomingHint: 'Hides bills you already marked as paid.',
  fullTimeline: 'Full timeline',

  cushionTight: (upcoming: string, cushion: string) =>
    `About ${upcoming} is due in the next ten days. Your plan leaves roughly ${cushion} for bills. A quick heads-up—not your bank balance.`,
  cushionComfortable: (upcoming: string) =>
    `About ${upcoming} is due in the next ten days.`,

  overdueBanner: (count: number) =>
    `${count} bill${count === 1 ? '' : 's'} need a look—still unpaid after the due date.`,

  statusPaid: glossary.paid,
  statusOverdue: glossary.overdue,
  statusUpcoming: glossary.upcoming,
  statusDueSoon: (days: number) => `Due soon · ${days} weekday${days === 1 ? '' : 's'}`,
  statusGrace: 'Grace period',

  markControls: {
    actualPaidLabel: glossary.actualPaid,
    markAsPaid: glossary.markAsPaid,
    undoPaid: glossary.undoPaid,
    planLabel: glossary.plan,
    paidLabel: glossary.paid,
  },

  confirmDialog: {
    eyebrow: 'Confirm payment',
    title: 'Mark as paid?',
    countsAsPaid: (monthKey: string) =>
      `Counts as paid for ${monthKey} on your bill calendar.`,
    incomeVsSpendChip: (who: string) => `Income vs spend → ${who}`,
    signedInNote: 'Based on who is signed in now.',
    disclaimer: glossary.workbookOnly,
    cancel: 'Cancel',
    confirm: glossary.markAsPaid,
  },
} as const;
