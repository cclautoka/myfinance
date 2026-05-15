import { z } from 'zod';

export const householdModeSchema = z.enum(['single', 'couple']);

const money = z.coerce.number().finite().min(0);

export const setupIncomeStepSchema = z
  .object({
    mode: householdModeSchema,
    husbandMonthly: money,
    wifeMonthly: money,
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
  });

export const setupEssentialsStepSchema = z.object({
  monthlyBaseline: z.coerce.number().finite().min(1, 'Enter a monthly essentials baseline (at least $1).'),
});

export const setupDebtsStepSchema = z
  .object({
    noDebts: z.boolean(),
    name: z.string().trim(),
    balance: z.coerce.number().finite(),
    monthlyPayment: z.coerce.number().finite(),
    dueDay: z.coerce.number().int().min(1).max(31),
  })
  .superRefine((val, ctx) => {
    if (val.noDebts) return;
    if (!val.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Name the account or check “no debts”.', path: ['name'] });
    }
    if (val.balance <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Balance must be greater than zero.', path: ['balance'] });
    }
    if (val.monthlyPayment < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum payment cannot be negative.', path: ['monthlyPayment'] });
    }
  });

export const setupAlertsStepSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().trim(),
    householdId: z.string().trim(),
    husbandEmail: z.string().trim(),
    wifeEmail: z.string().trim(),
  })
  .superRefine((val, ctx) => {
    if (!val.enabled) return;
    if (!val.url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Notify URL is required when alerts are on.', path: ['url'] });
    }
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

export type SetupIncomeStepInput = z.infer<typeof setupIncomeStepSchema>;
export type SetupEssentialsStepInput = z.infer<typeof setupEssentialsStepSchema>;
export type SetupDebtsStepInput = z.infer<typeof setupDebtsStepSchema>;
export type SetupAlertsStepInput = z.infer<typeof setupAlertsStepSchema>;

export function zodIssuesToRecord(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.length ? i.path.join('.') : '_root';
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
