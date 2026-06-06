import type { SurprisePaidByRole } from '../types/finance';
import { readHouseholdSession } from './householdSession';

export function surprisePaidByLabel(role: SurprisePaidByRole): string {
  return role === 'owner' ? 'Primary' : 'Partner';
}

/** Default tag from signed-in member (owner → Primary, partner → Partner). */
export function defaultSurprisePaidByRole(): SurprisePaidByRole {
  const sess = readHouseholdSession();
  return sess?.role === 'partner' ? 'partner' : 'owner';
}

export const SURPRISE_PAID_BY_OPTIONS: { value: SurprisePaidByRole; label: string }[] = [
  { value: 'owner', label: 'Primary' },
  { value: 'partner', label: 'Partner' },
];

/** Segmented control for auto-deduction “paid by” in plan editor tables. */
export const AUTO_DEDUCTION_PAID_BY_SEGMENT: { id: SurprisePaidByRole; label: string }[] = [
  { id: 'owner', label: 'Primary' },
  { id: 'partner', label: 'Partner' },
];
