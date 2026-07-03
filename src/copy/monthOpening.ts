export const monthOpening = {
  gateLabel: 'Month not opened yet',
  title: (monthHeading: string) => `Set ${monthHeading} before continuing`,
  intro: (prevHeading: string, monthHeading: string) =>
    `Leftover from ${prevHeading} can go to your emergency pool and savings goals, or roll into ${monthHeading} as carry-over. Leave every field blank to carry it all forward — or use “Start fresh” below if that leftover does not match your real cash.`,
  tourNote: 'First time this month? After you unlock, you can run the short guided tour. Tools has replay too.',
  leftoverTitle: (prevHeading: string) => `Leftover from ${prevHeading}`,
  leftoverDetail:
    'Prior-month carry plus deposits, minus bills marked as paid and emergency sweeps already taken. Not your bank balance.',
  dueSoonTitle: (monthHeading: string) => `Due soon (first ~10 days of ${monthHeading})`,
  dueSoonEmpty: 'No bills dated in that window.',
  dueSoonPaidSuffix: ' · paid',
  savingsSectionTitle: 'Move from leftover into savings (optional)',
  emergencyFieldLabel: 'Emergency / $1k pool',
  emergencyFieldHelp:
    'Adds to your rainy-day balance on the Dashboard. Separate from carry-over for daily spending.',
  emergencyPlaceholder: '0.00 — blank for none',
  goalPlaceholder: '0.00 — blank for none',
  capNote: (slack: string) =>
    `Total directed to savings cannot exceed ${slack}. The rest rolls into carry-over.`,
  slackFlatNote:
    'Leftover is flat or negative. Carry-over stays $0 unless you adjust it later on the cashflow card.',
  carryPreviewTitle: 'Roll into this month (carry-over preview)',
  carryPreviewFormula: (slack: string, allocated: string) =>
    `${slack} leftover minus ${allocated} to savings`,
  saveUnlock: (monthHeading: string) => `Save & unlock ${monthHeading}`,
  saveUnlockTour: 'Save & unlock — then start guided tour',
  startFresh: (monthHeading: string) => `Start fresh — no carry into ${monthHeading}`,
  startFreshHelp:
    'Skips leftover carry-over. Only paycheques you log this month count toward pocket left — use this when the shown leftover does not match your bank.',
  cardSectionTitle: 'Credit card — available to use (optional)',
  cardSectionHelp:
    'Enter the available balance from your bank app (e.g. $0.51 ANZ, $34.44 BSP). Use a negative amount if you are over the limit. We derive owed from credit limit − available. Set limits in Household first. Blank = skip.',
  cardPlaceholder: 'Available from bank app (negative if over limit)',
} as const;
