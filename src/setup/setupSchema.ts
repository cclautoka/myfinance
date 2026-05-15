import { z } from 'zod';
import type { DebtAccount, EssentialExpense, OtherPlannedIncomeEntry, SavingsGoal } from '../types/finance';

export const householdModeSchema = z.enum(['single', 'couple']);

const money = z.coerce.number().finite().min(0);

const otherIncomeRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  amount: z.coerce.number().finite(),
});

const essentialRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.coerce.number().finite(),
  cadence: z.enum(['month', 'week']),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  weeklyDueWeekday: z.coerce.number().int().min(0).max(6).optional(),
});

const debtRowSchema = z.object({
  id: z.string(),
  name: z.string().trim(),
  balance: z.coerce.number().finite(),
  monthlyPayment: z.coerce.number().finite(),
  dueDay: z.coerce.number().int().min(1).max(31),
  autoDeduction: z.boolean(),
  endsOn: z.string().nullable().optional(),
  kind: z.enum(['card', 'installment', 'loan', 'personal']),
  annualInterestApr: z.coerce.number().finite().optional(),
});

const savingsGoalRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetAmount: z.coerce.number().finite(),
  balance: z.coerce.number().finite(),
});

export const setupIncomeStepSchema = z
  .object({
    mode: householdModeSchema,
    husbandMonthly: money,
    wifeMonthly: money,
    otherPlannedIncome: z.array(otherIncomeRowSchema),
  })
  .superRefine((val, ctx) => {
    if (val.mode === 'single') {
      if (Math.max(val.husbandMonthly, val.wifeMonthly) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter planned monthly income for your household.',
          path: ['husbandMonthly'],
        });
      }
    } else if (val.husbandMonthly <= 0 || val.wifeMonthly <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Both earners need a planned monthly income greater than zero.',
        path: ['husbandMonthly'],
      });
    }
    for (let i = 0; i < val.otherPlannedIncome.length; i++) {
      const r = val.otherPlannedIncome[i];
      const hasLabel = r.label.trim().length > 0;
      const hasAmount = r.amount > 0;
      if (hasLabel !== hasAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each extra income row needs both a label and an amount greater than zero.',
          path: ['otherPlannedIncome', i],
        });
      }
    }
  });

export const setupEssentialsStepSchema = z
  .object({
    rows: z.array(essentialRowSchema),
  })
  .superRefine((val, ctx) => {
    const valid = val.rows.filter((r) => r.name.trim() && r.amount > 0);
    if (valid.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one bill with a name and amount greater than zero.',
        path: ['rows'],
      });
    }
  });

export const setupDebtsStepSchema = z
  .object({
    rows: z.array(debtRowSchema),
  })
  .superRefine((val, ctx) => {
    for (let i = 0; i < val.rows.length; i++) {
      const r = val.rows[i];
      if (!r.name.trim()) continue;
      if (r.monthlyPayment < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payment cannot be negative.',
          path: ['rows', i, 'monthlyPayment'],
        });
      }
      const needsBalance = r.kind === 'card' || r.kind === 'loan' || r.kind === 'personal';
      if (needsBalance && r.balance <= 0 && r.monthlyPayment <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a balance or monthly payment for this account.',
          path: ['rows', i, 'balance'],
        });
      }
      if (r.kind === 'installment' && r.balance <= 0 && r.monthlyPayment <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'HP / installment rows need a payment amount.',
          path: ['rows', i, 'monthlyPayment'],
        });
      }
    }
  });

export const setupSavingsStepSchema = z
  .object({
    plannedSavingsMonthly: money,
    emergencyFund: money,
    goals: z.array(savingsGoalRowSchema),
  })
  .superRefine((val, ctx) => {
    for (let i = 0; i < val.goals.length; i++) {
      const g = val.goals[i];
      const hasName = g.name.trim().length > 0;
      const hasTarget = g.targetAmount > 0;
      if (hasName && !hasTarget) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Set a target amount greater than zero for this goal.',
          path: ['goals', i, 'targetAmount'],
        });
      }
      if (!hasName && (hasTarget || g.balance > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Name this savings goal.',
          path: ['goals', i, 'name'],
        });
      }
    }
  });

export const setupFunMoneyStepSchema = z.object({
  mode: householdModeSchema,
  plannedPersonalMonthly: money,
  husbandBudget: money,
  wifeBudget: money,
});

export const setupAlertsStepSchema = z
  .object({
    enabled: z.boolean(),
    householdId: z.string().trim(),
    husbandEmail: z.string().trim(),
    wifeEmail: z.string().trim(),
  })
  .superRefine((val, ctx) => {
    if (!val.enabled) return;
    if (!/^[a-f0-9]{16,64}$/i.test(val.householdId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Household id must be a 16–64 character hex string.',
        path: ['householdId'],
      });
    }
    const he = val.husbandEmail.includes('@');
    const we = val.wifeEmail.includes('@');
    if (!he && !we) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one recipient email.',
        path: ['husbandEmail'],
      });
    }
  });

export function sanitizeSetupEssentials(rows: EssentialExpense[]): EssentialExpense[] {
  const valid = rows.filter((r) => r.name.trim() && r.amount > 0);
  return valid.length > 0 ? valid : rows.slice(0, 1);
}

export function sanitizeSetupDebts(rows: DebtAccount[]): DebtAccount[] {
  return rows.filter((r) => r.name.trim());
}

export function sanitizeOtherPlannedIncome(rows: OtherPlannedIncomeEntry[]): OtherPlannedIncomeEntry[] {
  return rows.filter((r) => r.label.trim() && r.amount > 0);
}

export function sanitizeSavingsGoals(rows: SavingsGoal[]): SavingsGoal[] {
  return rows.filter((g) => g.name.trim() && g.targetAmount > 0);
}

export type SetupIncomeStepInput = z.infer<typeof setupIncomeStepSchema>;
export type SetupEssentialsStepInput = z.infer<typeof setupEssentialsStepSchema>;
export type SetupDebtsStepInput = z.infer<typeof setupDebtsStepSchema>;
export type SetupSavingsStepInput = z.infer<typeof setupSavingsStepSchema>;
export type SetupFunMoneyStepInput = z.infer<typeof setupFunMoneyStepSchema>;
export type SetupAlertsStepInput = z.infer<typeof setupAlertsStepSchema>;

export function zodIssuesToRecord(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.length ? i.path.join('.') : '_root';
    if (!out[k]) out[k] = i.message;
    if ((i.path[0] === 'rows' || i.path[0] === 'goals') && !out._root) out._root = i.message;
  }
  return out;
}
