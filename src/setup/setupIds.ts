export const newSetupId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export function createStarterEssential() {
  return {
    id: newSetupId('ess'),
    name: 'Rent',
    amount: 0,
    cadence: 'month' as const,
    dueDay: 1,
  };
}

export function createStarterDebt() {
  return {
    id: newSetupId('debt'),
    name: 'New loan / HP / payment',
    balance: 0,
    monthlyPayment: 0,
    dueDay: 1,
    autoDeduction: false,
    endsOn: null as string | null,
    kind: 'loan' as const,
    annualInterestApr: 0,
  };
}
