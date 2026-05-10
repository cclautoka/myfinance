import type { DebtKind, ExtraIncomeCategory, IncomeEarner, PaySchedule, SurpriseCategory } from '../types/finance';

export const PAY_SCHEDULE_OPTIONS: { value: PaySchedule; label: string }[] = [
  { value: 'weekly', label: 'Weekly (÷4 checks / month vs monthly plan)' },
  { value: 'biweekly', label: 'Biweekly (~26 pays / yr)' },
  { value: 'monthly', label: 'Monthly (1 check)' },
];

export const ESSENTIAL_CADENCE_OPTIONS: { value: 'month' | 'week'; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'week', label: 'Weekly' },
];

/** Stored as EssentialExpense.weeklyDueWeekday (Date.getDay()). */
export const WEEKLY_ESSENTIAL_DAY_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export const DEBT_KIND_OPTIONS: { value: DebtKind; label: string }[] = [
  { value: 'card', label: 'Credit card' },
  { value: 'installment', label: 'Installment / HP' },
  { value: 'loan', label: 'Loan' },
  { value: 'personal', label: 'Personal' },
];

export const INCOME_EARNER_OPTIONS: { value: IncomeEarner; label: string }[] = [
  { value: 'husband', label: 'Husband lane' },
  { value: 'wife', label: 'Wife lane' },
  { value: 'joint', label: 'Joint (household deposit)' },
];

/** Paycheque log edit row uses shorter labels. */
export const INCOME_EARNER_OPTIONS_SHORT: { value: IncomeEarner; label: string }[] = [
  { value: 'husband', label: 'Husband' },
  { value: 'wife', label: 'Wife' },
  { value: 'joint', label: 'Joint' },
];

export const EXTRA_INCOME_CATEGORY_OPTIONS: { value: ExtraIncomeCategory; label: string }[] = [
  { value: 'overtime', label: 'Overtime' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'gift', label: 'Gift' },
  { value: 'side', label: 'Side work' },
  { value: 'other', label: 'Other' },
];

export const SURPRISE_CATEGORY_OPTIONS: { value: SurpriseCategory; label: string }[] = [
  { value: 'car_repair', label: 'Car / transport' },
  { value: 'medical', label: 'Health' },
  { value: 'home', label: 'Home / repairs' },
  { value: 'travel', label: 'Travel' },
  { value: 'family', label: 'Family / kids' },
  { value: 'other', label: 'Something else' },
];
