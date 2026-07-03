import { describe, expect, it } from 'vitest';
import type { DebtAccount } from '../types/finance';
import { applyCardAvailableCheckIn, cardAvailableFromOwed, cardOwedFromAvailable } from './cardCredit';

const card = (overrides: Partial<DebtAccount> = {}): DebtAccount => ({
  id: 'c1',
  name: 'ANZ',
  balance: 0,
  monthlyPayment: 200,
  dueDay: 1,
  autoDeduction: false,
  kind: 'card',
  creditLimit: 2500,
  ...overrides,
});

describe('cardOwedFromAvailable', () => {
  it('derives owed from limit minus available', () => {
    expect(cardOwedFromAvailable(2500, 0.51)).toBe(2499.49);
    expect(cardOwedFromAvailable(10000, 34.44)).toBe(9965.56);
  });

  it('allows negative available (over limit)', () => {
    expect(cardOwedFromAvailable(2500, -50)).toBe(2550);
  });
});

describe('cardAvailableFromOwed', () => {
  it('derives available when limit is set', () => {
    expect(cardAvailableFromOwed(card({ balance: 2499.49, creditLimit: 2500 }))).toBe(0.51);
  });

  it('returns null without credit limit', () => {
    expect(cardAvailableFromOwed(card({ balance: 1000, creditLimit: undefined }))).toBeNull();
  });
});

describe('applyCardAvailableCheckIn', () => {
  it('updates balance and optional limit', () => {
    const next = applyCardAvailableCheckIn(card({ creditLimit: undefined }), 34.44, 10000);
    expect(next?.creditLimit).toBe(10000);
    expect(next?.balance).toBe(9965.56);
  });
});
