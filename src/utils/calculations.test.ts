import { describe, expect, it } from 'vitest';
import type { DebtAccount, FinanceState } from '../types/finance';
import { effectiveDebtBalance, totalDebtRemaining } from './calculations';
import { unpaidDebtContractRemaining } from './billsTimeline';

function hp(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: 'hp-phone',
    name: 'HP Phone',
    balance: 0,
    monthlyPayment: 281,
    dueDay: 4,
    autoDeduction: true,
    endsOn: '2026-07-31',
    kind: 'installment',
    ...overrides,
  };
}

function stateWithPaidMonths(monthKeys: string[]): FinanceState {
  return {
    debts: [hp()],
    billsPaid: { 'hp-phone': monthKeys },
    billPaidAmounts: {},
  } as FinanceState;
}

describe('unpaidDebtContractRemaining', () => {
  it('counts only unpaid installments through endsOn', () => {
    const state = stateWithPaidMonths(['2026-05', '2026-06']);
    expect(unpaidDebtContractRemaining(state, hp())).toBe(281);
  });

  it('counts all contract months when nothing marked paid', () => {
    const state = stateWithPaidMonths([]);
    expect(unpaidDebtContractRemaining(state, hp())).toBe(281 * 3);
  });
});

describe('effectiveDebtBalance with HP schedule', () => {
  it('uses bill calendar when state is provided', () => {
    const state = stateWithPaidMonths(['2026-05', '2026-06']);
    expect(effectiveDebtBalance(hp(), new Date('2026-06-06'), state)).toBe(281);
  });

  it('returns zero when every installment is marked paid', () => {
    const state = stateWithPaidMonths(['2026-05', '2026-06', '2026-07']);
    expect(effectiveDebtBalance(hp(), new Date('2026-06-06'), state)).toBe(0);
  });

  it('falls back to time estimate without state', () => {
    const bal = effectiveDebtBalance(hp(), new Date('2026-06-06'));
    expect(bal).toBeGreaterThan(281);
  });
});

describe('totalDebtRemaining', () => {
  it('includes schedule-based HP in total when state provided', () => {
    const state = stateWithPaidMonths(['2026-05', '2026-06']);
    expect(totalDebtRemaining(state.debts, new Date('2026-06-06'), state)).toBe(281);
  });
});
