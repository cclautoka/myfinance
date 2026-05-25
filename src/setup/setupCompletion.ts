import type { FinanceState } from '../types/finance';
import type { NotifyRelayConfig } from '../utils/notifyRelayConfig';
import { readHouseholdSession } from '../utils/householdSession';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import { HOUSEHOLD_SETUP_STORAGE_KEY, HOUSEHOLD_SETUP_VERSION } from './constants';

function resolveHouseholdId(householdId?: string): string {
  return (
    householdId?.trim() ||
    readHouseholdSession()?.householdId?.trim() ||
    ''
  );
}

function setupStorageKey(householdId?: string): string {
  const hid = resolveHouseholdId(householdId);
  return hid ? `${HOUSEHOLD_SETUP_STORAGE_KEY}-${hid}` : HOUSEHOLD_SETUP_STORAGE_KEY;
}

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

/** Prefer stored mode; infer from income when localStorage was cleared (e.g. fresh app install). */
export function effectiveHouseholdMode(state: FinanceState): HouseholdMode {
  try {
    const v = localStorage.getItem(HOUSEHOLD_MODE_KEY);
    if (v === 'single' || v === 'couple') return v;
  } catch {
    /* ignore */
  }
  const h = Number(state.income.husbandMonthly) || 0;
  const w = Number(state.income.wifeMonthly) || 0;
  if (h > 0 && w > 0) return 'couple';
  return 'single';
}

export function readHouseholdSetupCompletion(householdId?: string): HouseholdSetupCompletion | null {
  try {
    const raw = localStorage.getItem(setupStorageKey(householdId));
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

export function markHouseholdSetupFinished(householdId?: string): void {
  try {
    const next: HouseholdSetupCompletion = {
      version: HOUSEHOLD_SETUP_VERSION,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(setupStorageKey(householdId), JSON.stringify(next));
    // Legacy global key — remove so a different household is not treated as done.
    localStorage.removeItem(HOUSEHOLD_SETUP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearHouseholdSetupCompletion(householdId?: string): void {
  try {
    const hid = resolveHouseholdId(householdId);
    if (hid) localStorage.removeItem(setupStorageKey(hid));
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
  const mode = effectiveHouseholdMode(state);
  if (!incomeOk(mode, state.income)) return false;
  if (essentialsBaselineTotal(state) <= 0) return false;
  return true;
}

/**
 * One-time: if user already had a filled workbook before the wizard existed, record completion.
 */
export function maybeMigrateLegacyHouseholdSetup(state: FinanceState, cfg: NotifyRelayConfig): void {
  if (readHouseholdSetupCompletion(cfg.householdId)) return;
  if (!legacyHouseholdLooksComplete(state, cfg)) return;
  markHouseholdSetupFinished(cfg.householdId);
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
  _completion: HouseholdSetupCompletion | null = readHouseholdSetupCompletion(cfg.householdId),
): boolean {
  const mode = effectiveHouseholdMode(state);
  if (!incomeOk(mode, state.income)) return false;
  if (essentialsBaselineTotal(state) <= 0) return false;
  if (!notifyOk(cfg)) return false;
  return true;
}

export function syncHouseholdSetupFromServerState(state: FinanceState, cfg: NotifyRelayConfig): boolean {
  maybeMigrateLegacyHouseholdSetup(state, cfg);

  const completion = readHouseholdSetupCompletion(cfg.householdId);
  if (completion) {
    return householdSetupMirrorsComplete(state, cfg, completion);
  }

  const mode = effectiveHouseholdMode(state);
  if (!incomeOk(mode, state.income)) return false;

  const hasEssentials = essentialsBaselineTotal(state) > 0;
  const hasDebts = state.debts.length > 0;
  if (hasEssentials || hasDebts) {
    markHouseholdSetupFinished(cfg.householdId);
    const after = readHouseholdSetupCompletion(cfg.householdId);
    return Boolean(after && householdSetupMirrorsComplete(state, cfg, after));
  }

  if (mode === 'couple' && state.income.husbandMonthly > 0 && state.income.wifeMonthly > 0) {
    markHouseholdSetupFinished(cfg.householdId);
    return true;
  }
  if (mode === 'single') {
    const top = Math.max(state.income.husbandMonthly, state.income.wifeMonthly);
    if (top > 0) {
      markHouseholdSetupFinished(cfg.householdId);
      return true;
    }
  }

  return false;
}

export function isHouseholdSetupComplete(
  state: FinanceState,
  cfg: NotifyRelayConfig,
  options?: { serverWorkbookExists?: boolean },
): boolean {
  if (options?.serverWorkbookExists) return true;
  return syncHouseholdSetupFromServerState(state, cfg);
}

/** After server hydration — record wizard done when workbook already exists on server. */
export function tryCompleteSetupFromServerState(state: FinanceState, cfg: NotifyRelayConfig): boolean {
  const ok = syncHouseholdSetupFromServerState(state, cfg);
  if (ok) markHouseholdSetupFinished(cfg.householdId);
  return ok;
}
