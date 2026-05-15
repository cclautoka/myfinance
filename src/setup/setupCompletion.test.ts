import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultFinanceState } from '../data/defaults';
import type { FinanceState } from '../types/finance';
import { HOUSEHOLD_MODE_KEY } from '../utils/householdMode';
import { HOUSEHOLD_SETUP_STORAGE_KEY } from './constants';
import {
  clearHouseholdSetupCompletion,
  isHouseholdSetupComplete,
  markHouseholdSetupFinished,
  maybeMigrateLegacyHouseholdSetup,
} from './setupCompletion';
import { setupIncomeStepSchema, setupEssentialsStepSchema } from './setupSchema';
import { createStarterEssential } from './setupIds';

function mockLocalStorage() {
  const s: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null),
    setItem: (k: string, v: string) => {
      s[k] = String(v);
    },
    removeItem: (k: string) => {
      delete s[k];
    },
    clear: () => {
      for (const k of Object.keys(s)) delete s[k];
    },
    key: (i: number) => Object.keys(s)[i] ?? null,
    get length() {
      return Object.keys(s).length;
    },
  } as Storage;
  vi.stubGlobal('localStorage', ls);
}

const baseNotify = {
  enabled: false,
  url: '',
  secret: '',
  husbandEmail: '',
  wifeEmail: '',
  householdId: 'abcd1234abcd1234abcd1234abcd1234',
};

function filledState(): FinanceState {
  const s = defaultFinanceState();
  return {
    ...s,
    income: { ...s.income, husbandMonthly: 3000, wifeMonthly: 2000 },
    essentials: [{ id: 'e1', name: 'Rent', amount: 1200, cadence: 'month' as const, dueDay: 1 }],
    debts: [],
  };
}

describe('setupCompletion', () => {
  beforeEach(() => {
    mockLocalStorage();
    localStorage.setItem(HOUSEHOLD_MODE_KEY, 'couple');
  });

  it('is incomplete for fresh defaults', () => {
    expect(isHouseholdSetupComplete(defaultFinanceState(), baseNotify)).toBe(false);
  });

  it('migrates legacy workbook once mirrors pass', () => {
    const s = filledState();
    expect(localStorage.getItem(HOUSEHOLD_SETUP_STORAGE_KEY)).toBeNull();
    maybeMigrateLegacyHouseholdSetup(s, baseNotify);
    expect(localStorage.getItem(HOUSEHOLD_SETUP_STORAGE_KEY)).not.toBeNull();
    expect(isHouseholdSetupComplete(s, baseNotify)).toBe(true);
  });

  it('requires noDebtsClaim when completion exists and debts empty', () => {
    const s = filledState();
    markHouseholdSetupFinished(false);
    expect(isHouseholdSetupComplete(s, baseNotify)).toBe(false);
    clearHouseholdSetupCompletion();
    markHouseholdSetupFinished(true);
    expect(isHouseholdSetupComplete(s, baseNotify)).toBe(true);
  });

  it('skips wizard when server already has couple income but no essentials', () => {
    const s = defaultFinanceState();
    s.income = { ...s.income, husbandMonthly: 1600, wifeMonthly: 1800 };
    expect(localStorage.getItem(HOUSEHOLD_SETUP_STORAGE_KEY)).toBeNull();
    expect(isHouseholdSetupComplete(s, baseNotify)).toBe(true);
    expect(localStorage.getItem(HOUSEHOLD_SETUP_STORAGE_KEY)).not.toBeNull();
  });
});

describe('setupSchema', () => {
  it('rejects couple income when one earner is zero', () => {
    const r = setupIncomeStepSchema.safeParse({
      mode: 'couple',
      husbandMonthly: 0,
      wifeMonthly: 100,
    });
    expect(r.success).toBe(false);
  });

  it('accepts single with one positive earner', () => {
    const r = setupIncomeStepSchema.safeParse({
      mode: 'single',
      husbandMonthly: 2500,
      wifeMonthly: 0,
    });
    expect(r.success).toBe(true);
  });

  it('accepts optional other consistent income', () => {
    const r = setupIncomeStepSchema.safeParse({
      mode: 'couple',
      husbandMonthly: 2000,
      wifeMonthly: 1500,
      otherPlannedMonthly: 400,
    });
    expect(r.success).toBe(true);
  });

  it('essentials require at least one named row with amount', () => {
    const starter = createStarterEssential();
    expect(setupEssentialsStepSchema.safeParse({ rows: [{ ...starter, amount: 0 }] }).success).toBe(
      false,
    );
    expect(
      setupEssentialsStepSchema.safeParse({ rows: [{ ...starter, name: 'Rent', amount: 100 }] })
        .success,
    ).toBe(true);
  });
});
