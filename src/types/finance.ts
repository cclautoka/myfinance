export type ThemePreference = 'light' | 'dark' | 'system';

export type BillPaymentAttribution = {
  role: 'owner' | 'partner';
  memberEmail?: string;
  platform: 'web' | 'ios' | 'android';
  at: string;
};

/** Matches how usual pay relates to Household “monthly” — used only for cheque / OT hints. */
export type PaySchedule = 'weekly' | 'biweekly' | 'monthly';

export type ExtraIncomeCategory = 'overtime' | 'bonus' | 'gift' | 'side' | 'other';

export type DebtKind = 'card' | 'installment' | 'loan' | 'personal';

export interface IncomeConfig {
  husbandMonthly: number;
  wifeMonthly: number;
  husbandPayNote: string;
  wifePayNote: string;
  husbandPaySchedule: PaySchedule;
  wifePaySchedule: PaySchedule;
  /** Override expected amount per cheque; 0 → derive from monthly ÷ schedule in Paycheque hints. */
  husbandTypicalPerPay: number;
  wifeTypicalPerPay: number;
  /**
   * When true, inserts paycheque log rows on each scheduled payday (anchor + usual pay rhythm), after local noon,
   * when no row exists for that earner + date.
   */
  husbandPayAutoLog?: boolean;
  /** Start date `YYYY-MM-DD` for auto pay lines; next paydays follow husband’s pay rhythm above. */
  husbandPayAnchor?: string | null;

  wifePayAutoLog?: boolean;
  /** Start date `YYYY-MM-DD`; next paydays follow wife’s pay rhythm (weekly +7d, biweekly +14d, monthly same DOM). */
  wifeBiweeklyPayAnchor?: string | null;
  /** @deprecated Migrated to otherPlannedIncome on load — do not use in new UI */
  otherPlannedMonthly?: number;
  /** Steady monthly income beyond husband/wife (rental, benefits, side gig, etc.) */
  otherPlannedIncome?: OtherPlannedIncomeEntry[];
}

/** Recurring monthly income outside husband/wife pay — counted in planned income totals */
export interface OtherPlannedIncomeEntry {
  id: string;
  label: string;
  amount: number;
}

/** Named savings target with optional balance tracked toward the goal */
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  balance: number;
}

export interface EssentialExpense {
  id: string;
  name: string;
  amount: number;
  cadence: 'month' | 'week';
  /** Day of month the bill falls on — only used when `cadence` is month (defaults to 15 in the timeline when omitted). */
  dueDay?: number;
  /** `Date.getDay()`: 0 Sun … 6 Sat — only used when `cadence` is week (defaults to 6 Saturday). */
  weeklyDueWeekday?: number;
}

export interface DebtAccount {
  id: string;
  name: string;
  /** What you owe today — type this from statements; we do **not** add interest into it automatically. */
  balance: number;
  monthlyPayment: number;
  dueDay: number;
  autoDeduction: boolean;
  endsOn?: string | null;
  kind: DebtKind;
  /** Optional annual APR % — used only for a rough “interest this month” hint; 0 / omit = hide. */
  annualInterestApr?: number;
}

export interface AllocationPercents {
  essentials: number;
  debt: number;
  savings: number;
  groceries: number;
  personal: number;
}

export interface PersonalWallets {
  husbandBudget: number;
  wifeBudget: number;
  husbandSpent: number;
  wifeSpent: number;
}

export type IncomeEarner = 'husband' | 'wife' | 'joint';

/** Actual pay deposited — use to compare with the monthly plan from Household data. */
export interface IncomeLogEntry {
  id: string;
  date: string;
  amount: number;
  earner: IncomeEarner;
  label: string;
}

export interface ExtraIncomeEntry {
  id: string;
  label: string;
  amount: number;
  date: string;
  category: ExtraIncomeCategory;
}

export type SurpriseCategory =
  | 'car_repair'
  | 'medical'
  | 'home'
  | 'travel'
  | 'family'
  | 'other';

/** Who paid / logged this surprise (Primary = owner, Partner = partner session). */
export type SurprisePaidByRole = 'owner' | 'partner';

/** One-off costs that were not in the regular plan (vet bill, broken fridge, etc.) */
export interface SurpriseExpenseEntry {
  id: string;
  label: string;
  amount: number;
  date: string;
  category: SurpriseCategory;
  /** Primary vs Partner — used on income vs spend chart. */
  paidByRole?: SurprisePaidByRole;
}

/** Dollars you moved from planned “unallocated” room into the emergency saver (manual bookkeeping). */
export interface BudgetSurplusSweepEntry {
  id: string;
  monthKey: string;
  amount: number;
  /** Calendar date you tapped the sweep (ISO yyyy-mm-dd). */
  date: string;
  /** Primary vs Partner — used in income vs spend chart + widgets. */
  paidByRole?: SurprisePaidByRole;
}

export interface MonthCashflowOpeningAllocations {
  emergency?: number;
  goals?: Record<string, number>;
}

export interface MonthCashflowOpening {
  /** ISO yyyy-mm-dd when you confirmed this month’s opening. */
  confirmedAt: string;
  /** This record always keys the same bucket (redundant; useful for CSV/debug). */
  forMonthKey: string;
  /** Prior calendar month we used to read unused slack. */
  settledFromPriorMonthKey: string;
  /** surplus room from prior month (`net incl. carry` − sweeps) at the time you closed. */
  priorSurplusRemainderShown: number;
  /** Dollars you’re moving off the “rollover” pile into savings (checking → savings story). */
  savingsDirectedAway: number;
  /** What we set as this month’s typed carry-in (slack minus savings, floored at 0). */
  carryApplied: number;
  /** Per-target split at confirm (emergency + savings goals). */
  allocations?: MonthCashflowOpeningAllocations;
  /** Saved automatically on upgrade from builds before month-opening existed. */
  migrated?: boolean;
}

/** Native app alert preferences — email summaries stay in Tools → Email heads-up. */
export interface PushNotificationPrefs {
  /** Daily bill reminder pushes when devices are registered (default on). */
  billReminders?: boolean;
}

export interface FinanceState {
  version: number;
  income: IncomeConfig;
  essentials: EssentialExpense[];
  debts: DebtAccount[];
  allocation: AllocationPercents;
  wallets: PersonalWallets;
  emergencyFund: number;
  /** Target for “3‑month cushion” milestone (legacy ring when savingsGoals is empty) */
  threeMonthFundTarget: number;
  /** Custom savings goals — rings and progress in Plan & Dashboard */
  savingsGoals: SavingsGoal[];
  /**
   * Planned dollars per month toward savings (after modelling essentials, groceries, debt in Household).
   * Pie + totals use this — not allocation.savings × income.
   */
  plannedSavingsMonthly: number;
  /** Planned monthly personal / discretionary envelope in dollars (ditto — not allocation.personal × income). */
  plannedPersonalMonthly: number;
  /** billId -> months (YYYY-MM) marked paid */
  billsPaid: Record<string, string[]>;
  /** billId -> payment-key (aligned with checklist toggles, see billPaymentKey) -> amount actually paid */
  billPaidAmounts: Record<string, Record<string, number>>;
  /** Who marked each bill occurrence handled (synced with server state). */
  billPaymentAttribution?: Record<string, Record<string, BillPaymentAttribution>>;
  /**
   * For auto-deduction bills: months the household tapped “Undo handled” so we do not keep
   * re-applying the automatic checkmark on every visit.
   */
  billsAutoUnmarked: Record<string, string[]>;
  /** Logged deposits this month vs planned income — see Paycheque log */
  incomeLog: IncomeLogEntry[];
  extraIncome: ExtraIncomeEntry[];
  /** Unexpected one-off spending — for memory and peace of mind, not judgment */
  surpriseExpenses: SurpriseExpenseEntry[];
  /**
   * Confirmed moves into Emergency from realized month cashflow slack (logged income + extra + optional typed
   * carry‑in, minus paid bill calendar lines + surprises), after earlier sweeps this month.
   */
  budgetSurplusSweeps: BudgetSurplusSweepEntry[];
  /**
   * Dollars you treat as spendable **this calendar month** on top of logged pay/extra —
   * e.g. checking cushion left after last month. Keyed `YYYY-MM`. Bookkeeping-only; defaults empty.
   */
  monthSpendableCarryByMonth?: Record<string, number>;
  /**
   * One-time confirmation per calendar month: how much prior-month slack went to savings vs rolled into
   * this month’s carry-in. Absent current month + meaningful activity → month-opening gate.
   */
  monthCashflowOpening?: Record<string, MonthCashflowOpening>;
  theme: ThemePreference;
  walletResetMonth: string;
  /**
   * Extra calendar days after a due date before the app shows OVERDUE (e.g. money leaves a day or two later).
   */
  billOverdueGraceDays?: number;
  /**
   * Bills whose due date falls within this many **weekdays starting tomorrow**
   * through the due date (inclusive) show a softer “closing in” hint (default 3).
   */
  billUpcomingLeadBusinessDays?: number;
  /** Household-wide app push preferences (synced with server state). */
  pushNotificationPrefs?: PushNotificationPrefs;
}

export interface TimelineBill {
  id: string;
  billId: string;
  name: string;
  amount: number;
  due: Date;
  autoDeduction: boolean;
  category: 'essential' | 'debt' | 'other';
}

export const STORAGE_KEY = 'our-finance-dashboard-v1';
