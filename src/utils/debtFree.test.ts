import { describe, expect, it } from 'vitest';
import type { DebtAccount, FinanceState } from '../types/finance';
import { currentMonthKey } from '../data/defaults';
import {
  debtFreeMonthsTrend,
  debtPayoffScenarioDelta,
  debtsIncludedInPayoffSim,
  estimatedDebtFreeMonths,
  simulateDebtPayoff,
  staleCardBalanceDebts,
} from './debtFree';
import { totalDebtRemaining } from './calculations';

function debt(overrides: Partial<DebtAccount> & Pick<DebtAccount, 'id' | 'name'>): DebtAccount {
  return {
    balance: 0,
    monthlyPayment: 0,
    dueDay: 1,
    autoDeduction: false,
    kind: 'loan',
    ...overrides,
  };
}

describe('debtsIncludedInPayoffSim', () => {
  it('excludes personal loans with zero payment', () => {
    const ref = new Date('2026-06-06');
    const debts = [
      debt({ id: 'p1', name: 'Personal', balance: 1000, kind: 'personal', monthlyPayment: 0 }),
      debt({ id: 'c1', name: 'Card', balance: 500, kind: 'card', monthlyPayment: 100, annualInterestApr: 20 }),
    ];
    expect(debtsIncludedInPayoffSim(debts, ref).map((d) => d.id)).toEqual(['c1']);
  });
});

describe('simulateDebtPayoff', () => {
  it('returns 0 months when no qualifying debts', () => {
    const ref = new Date('2026-06-06');
    const r = simulateDebtPayoff([], ref);
    expect(r.months).toBe(0);
  });

  it('pays off a simple loan in ceil(balance/payment) months', () => {
    const ref = new Date('2026-06-06');
    const debts = [debt({ id: 'c1', name: 'Card', balance: 1000, kind: 'card', monthlyPayment: 400 })];
    const r = simulateDebtPayoff(debts, ref);
    expect(r.months).toBe(3);
    expect(r.schedule[r.schedule.length - 1]?.totalBalance).toBe(0);
  });

  it('snowball redirect shortens payoff when a small debt clears first', () => {
    const ref = new Date('2026-06-06');
    const debts = [
      debt({ id: 'hp', name: 'HP', balance: 281, kind: 'installment', monthlyPayment: 281, endsOn: '2026-07-31' }),
      debt({ id: 'c1', name: 'Card', balance: 5000, kind: 'card', monthlyPayment: 200 }),
    ];
    const withoutRedirect = simulateDebtPayoff(debts, ref, { maxMonths: 120 });
    expect(withoutRedirect.months).not.toBeNull();
    // HP clears in 1 month; $281/mo snowballs onto the card — faster than card-only $200/mo.
    expect(withoutRedirect.months!).toBeLessThan(Math.ceil(5000 / 200));
  });

  it('HP drops off schedule after endsOn while card continues', () => {
    const ref = new Date('2026-06-06');
    const debts = [
      debt({
        id: 'hp',
        name: 'HP',
        balance: 0,
        kind: 'installment',
        monthlyPayment: 281,
        endsOn: '2026-07-31',
      }),
      debt({ id: 'c1', name: 'Card', balance: 1200, kind: 'card', monthlyPayment: 600 }),
    ];
    const r = simulateDebtPayoff(debts, ref);
    expect(r.months).toBe(2);
    const julyPoint = r.schedule.find((p) => p.monthLabel === '2026-08');
    expect(julyPoint?.totalBalance).toBe(0);
  });

  it('pushes debt-free date out when card balance increases', () => {
    const ref = new Date('2026-06-06');
    const low = [debt({ id: 'c1', name: 'Card', balance: 2000, kind: 'card', monthlyPayment: 200 })];
    const high = [debt({ id: 'c1', name: 'Card', balance: 4000, kind: 'card', monthlyPayment: 200 })];
    const mLow = simulateDebtPayoff(low, ref).months;
    const mHigh = simulateDebtPayoff(high, ref).months;
    expect(mHigh).toBeGreaterThan(mLow!);
  });

  it('extra card spend scenario adds months', () => {
    const ref = new Date('2026-06-06');
    const debts = [debt({ id: 'c1', name: 'Card', balance: 2500, kind: 'card', monthlyPayment: 400, annualInterestApr: 20.5 })];
    const delta = debtPayoffScenarioDelta(debts, ref, 100);
    expect(delta.baselineMonths).not.toBeNull();
    expect(delta.scenarioMonths).not.toBeNull();
    expect(delta.scenarioMonths!).toBeGreaterThan(delta.baselineMonths!);
    expect(delta.monthsAdded).toBeGreaterThan(0);
  });
});

describe('estimatedDebtFreeMonths', () => {
  it('returns null when only zero-payment debts exist', () => {
    const state = {
      debts: [debt({ id: 'p1', name: 'Personal', balance: 2000, kind: 'personal', monthlyPayment: 0 })],
    } as FinanceState;
    expect(estimatedDebtFreeMonths(state, new Date('2026-06-06'))).toBeNull();
  });

  it('still counts zero-payment personal in totalDebtRemaining', () => {
    const ref = new Date('2026-06-06');
    const debts = [debt({ id: 'p1', name: 'Personal', balance: 2000, kind: 'personal', monthlyPayment: 0 })];
    expect(totalDebtRemaining(debts, ref)).toBe(2000);
    expect(estimatedDebtFreeMonths({ debts } as FinanceState, ref)).toBeNull();
  });
});

describe('staleCardBalanceDebts', () => {
  it('flags cards without balanceUpdatedAt', () => {
    const ref = new Date('2026-06-06');
    const debts = [debt({ id: 'c1', name: 'BSP', balance: 9000, kind: 'card', monthlyPayment: 600 })];
    expect(staleCardBalanceDebts(debts, ref)).toHaveLength(1);
  });

  it('does not flag recently updated cards', () => {
    const ref = new Date('2026-06-06');
    const debts = [
      debt({
        id: 'c1',
        name: 'BSP',
        balance: 9000,
        kind: 'card',
        monthlyPayment: 600,
        balanceUpdatedAt: '2026-06-01',
      }),
    ];
    expect(staleCardBalanceDebts(debts, ref)).toHaveLength(0);
  });
});

describe('debtFreeMonthsTrend', () => {
  it('returns unknown when no prior snapshot exists', () => {
    const state = {
      debts: [debt({ id: 'c1', name: 'Card', balance: 1000, kind: 'card', monthlyPayment: 200 })],
    } as FinanceState;
    expect(debtFreeMonthsTrend(state).kind).toBe('unknown');
  });

  it('compares to this month opening snapshot and shows better when months drop', () => {
    const mk = currentMonthKey();
    const state = {
      debts: [debt({ id: 'c1', name: 'Card', balance: 800, kind: 'card', monthlyPayment: 200 })],
      debtFreeProjectionByMonth: { [mk]: { months: 21, totalDebt: 800 } },
    } as FinanceState;
    const trend = debtFreeMonthsTrend(state, new Date('2026-06-06'));
    expect(trend.currentMonths).toBeLessThan(21);
    expect(trend.kind).toBe('better');
    expect(trend.priorMonths).toBe(21);
  });
});
