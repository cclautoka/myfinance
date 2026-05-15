import type { FinanceState } from '../types/finance';
import type { NotifyRelayConfig } from '../utils/notifyRelayConfig';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import { HOUSEHOLD_SETUP_STORAGE_KEY, HOUSEHOLD_SETUP_VERSION } from './constants';

export type HouseholdSetupCompletion = {
  version: typeof HOUSEHOLD_SETUP_VERSION;
  completedAt: string;
};

export function readHouseholdMode(): HouseholdMode {
  try {
    const v = localStorage.getItem(HOUSEHOLD_MODE_KEY);
    return v === 'single' ? 'single' : 'couple';
  } catch {
    return 'couple';
  }
}

export function readHouseholdSetupCompletion(): HouseholdSetupCompletion | null {
  try {
    const raw = localStorage.getItem(HOUSEHOLD_SETUP_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<HouseholdSetupCompletion & { noDebtsClaim?: boolean }>;
    if (j?.version !== HOUSEHOLD_SETUP_VERSION || typeof j.completedAt !== 'string') return null;
    return {
      version: HOUSEHOLD_SETUP_VERSION,
      completedAt: j.completedAt,
    };
  } catch {
    return null;
  }
}

export function markHouseholdSetupFinished(): void {
  try {
    const next: HouseholdSetupCompletion = {
      version: HOUSEHOLD_SETUP_VERSION,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(HOUSEHOLD_SETUP_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearHouseholdSetupCompletion(): void {
  try {
    localStorage.removeItem(HOUSEHOLD_SETUP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function essentialsBaselineTotal(state: FinanceState): number {
  return state.essentials.reduce((sum, e) => {
    const a = Number(e.amount);
    if (!Number.isFinite(a) || a <= 0) return sum;
    return sum + (e.cadence === 'week' ? a * 4.33 : a);
  }, 0);
}

function incomeOk(mode: HouseholdMode, income: FinanceState['income']): boolean {
  const h = Number(income.husbandMonthly);
  const w = Number(income.wifeMonthly);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h < 0 || w < 0) return false;
  if (mode === 'single') {
    return Math.max(h, w) > 0;
  }
  return h > 0 && w > 0;
}

/** Pre-wizard households: enough real data to skip the gate once (income + essentials only). */
function legacyHouseholdLooksComplete(state: FinanceState, _cfg: NotifyRelayConfig): boolean {
  const mode = readHouseholdMode();
  if (!incomeOk(mode, state.income)) return false;
  if (essentialsBaselineTotal(state) <= 0) return false;
  return true;
}

/**
 * One-time: if user already had a filled workbook before the wizard existed, record completion.
 */
export function maybeMigrateLegacyHouseholdSetup(state: FinanceState, cfg: NotifyRelayConfig): void {
  if (readHouseholdSetupCompletion()) return;
  if (!legacyHouseholdLooksComplete(state, cfg)) return;
  markHouseholdSetupFinished();
}

function notifyOk(cfg: NotifyRelayConfig): boolean {
  if (!cfg.enabled) return true;
  const url = cfg.url.trim();
  const hid = cfg.householdId.trim();
  if (!url || !hid) return false;
  const he = cfg.husbandEmail.trim();
  const we = cfg.wifeEmail.trim();
  if (!he && !we) return true;
  return he.includes('@') || we.includes('@');
}

/**
 * True when persisted finance + relay snapshot satisfy the same bar the wizard enforces.
 */
export function householdSetupMirrorsComplete(
  state: FinanceState,
  cfg: NotifyRelayConfig,
  completion: HouseholdSetupCompletion | null = readHouseholdSetupCompletion(),
): boolean {
  const mode = readHouseholdMode();
  if (!incomeOk(mode, state.income)) return false;
  if (essentialsBaselineTotal(state) <= 0) return false;
  if (!notifyOk(cfg)) return false;
  return true;
}

export function syncHouseholdSetupFromServerState(state: FinanceState, cfg: NotifyRelayConfig): boolean {
  maybeMigrateLegacyHouseholdSetup(state, cfg);

  const completion = readHouseholdSetupCompletion();
  if (completion) {
    return householdSetupMirrorsComplete(state, cfg, completion);
  }

  const mode = readHouseholdMode();
  if (!incomeOk(mode, state.income)) return false;

  const hasEssentials = essentialsBaselineTotal(state) > 0;
  const hasDebts = state.debts.length > 0;
  if (hasEssentials || hasDebts) {
    markHouseholdSetupFinished();
    const after = readHouseholdSetupCompletion();
    return Boolean(after && householdSetupMirrorsComplete(state, cfg, after));
  }

  if (mode === 'couple' && state.income.husbandMonthly > 0 && state.income.wifeMonthly > 0) {
    markHouseholdSetupFinished();
    return true;
  }
  if (mode === 'single') {
    const top = Math.max(state.income.husbandMonthly, state.income.wifeMonthly);
    if (top > 0) {
      markHouseholdSetupFinished();
      return true;
    }
  }

  return false;
}

export function isHouseholdSetupComplete(state: FinanceState, cfg: NotifyRelayConfig): boolean {
  return syncHouseholdSetupFromServerState(state, cfg);
}
