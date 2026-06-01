import {
  currentMonthKey,
  defaultFinanceState,
  HISTORY_TRACKING_STARTED_MONTH_KEY,
  previousCalendarMonthKey,
} from './defaults';
import type {
  FinanceState,
  IncomeConfig,
  MonthCashflowOpening,
  OtherPlannedIncomeEntry,
  SavingsGoal,
} from '../types/finance';
import { STORAGE_KEY } from '../types/finance';
import { applyAutoScheduledPayLogs } from '../utils/autoScheduledPayLog';
import { applyAutoMarkHandled } from '../utils/autoBills';
import { monthSpendableCarry, surplusSweepRoomRemaining } from '../utils/budgetSurplus';
import { combinedMonthlyIncome } from '../utils/calculations';
import { hasMeaningfulFinanceTouch } from '../utils/monthOpening';
import {
  ensureNotifyRelayHouseholdId,
  readNotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import { getClientPlatform } from '../utils/clientPlatform';
import { loadThemePreference } from '../utils/themePreference';
import { householdApiFetch } from '../utils/householdApiFetch';
import { resolveHouseholdApiBase } from '../utils/householdApiBase';
import { clearHouseholdSession, readHouseholdSession } from '../utils/householdSession';
import { resolveNotifyRelayUrl } from '../utils/notifyRelayConfig';
import { serverAuthBearer } from '../utils/serverAuth';

/** Older builds stored weekly essentials with YYYY-MM so one toggle checked every week in the month — remove those stubs. */
const stripLegacyWeeklyEssentialMonthKeys = (state: FinanceState): FinanceState => {
  const monthOnly = /^\d{4}-\d{2}$/;
  const billsPaid = { ...state.billsPaid };
  const billPaidAmounts = { ...(state.billPaidAmounts ?? {}) };
  for (const e of state.essentials) {
    if (e.cadence !== 'week') continue;
    const keys = billsPaid[e.id];
    if (keys?.length) billsPaid[e.id] = keys.filter((k) => !monthOnly.test(k));
    const inner = { ...(billPaidAmounts[e.id] ?? {}) };
    for (const k of Object.keys(inner)) {
      if (monthOnly.test(k)) delete inner[k];
    }
    billPaidAmounts[e.id] = inner;
  }
  return { ...state, billsPaid, billPaidAmounts };
};

const PRE_TRACKING_DAY_CUTOFF = `${HISTORY_TRACKING_STARTED_MONTH_KEY}-01`;

/** Drop checklist keys from before in-app tracking started (e.g. demo data from 2025). */
const prunePreTrackingBillKeys = (state: FinanceState): FinanceState => {
  const monthMin = HISTORY_TRACKING_STARTED_MONTH_KEY;
  const keepPaidKey = (k: string): boolean => {
    if (/^\d{4}-\d{2}$/.test(k)) return k >= monthMin;
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return k >= PRE_TRACKING_DAY_CUTOFF;
    return true;
  };

  const billsPaid = { ...state.billsPaid };
  for (const id of Object.keys(billsPaid)) {
    billsPaid[id] = (billsPaid[id] ?? []).filter(keepPaidKey);
  }

  const billsAutoUnmarked = { ...(state.billsAutoUnmarked ?? {}) };
  for (const id of Object.keys(billsAutoUnmarked)) {
    billsAutoUnmarked[id] = (billsAutoUnmarked[id] ?? []).filter((k) => k >= monthMin);
  }

  const billPaidAmounts = { ...(state.billPaidAmounts ?? {}) };
  for (const id of Object.keys(billPaidAmounts)) {
    const inner = { ...billPaidAmounts[id] };
    for (const k of Object.keys(inner)) {
      if (!keepPaidKey(k)) delete inner[k];
    }
    billPaidAmounts[id] = inner;
  }

  return { ...state, billsPaid, billsAutoUnmarked, billPaidAmounts };
};

const migrateOtherPlannedIncome = (income: IncomeConfig): IncomeConfig => {
  if (income.otherPlannedIncome?.length) {
    return { ...income, otherPlannedIncome: income.otherPlannedIncome };
  }
  const legacy = Number(income.otherPlannedMonthly ?? 0);
  if (legacy > 0) {
    const row: OtherPlannedIncomeEntry = {
      id: 'legacy-other-planned',
      label: 'Other income',
      amount: legacy,
    };
    return { ...income, otherPlannedIncome: [row], otherPlannedMonthly: 0 };
  }
  return { ...income, otherPlannedIncome: [] };
};

/** Old saves lacked auto-pay keys — leave both earners off until opted in explicitly. */
const finalizeIncomeMergeForLoad = (template: IncomeConfig, partial?: Partial<IncomeConfig>): IncomeConfig => {
  const p = partial ?? {};
  const hasWAuto = Object.prototype.hasOwnProperty.call(p, 'wifePayAutoLog');
  const hasWAnchor = Object.prototype.hasOwnProperty.call(p, 'wifeBiweeklyPayAnchor');
  const hasHAuto = Object.prototype.hasOwnProperty.call(p, 'husbandPayAutoLog');
  const hasHAnchor = Object.prototype.hasOwnProperty.call(p, 'husbandPayAnchor');
  const merged: IncomeConfig = {
    ...template,
    ...p,
    husbandPayAutoLog: hasHAuto ? Boolean(p.husbandPayAutoLog) : false,
    husbandPayAnchor: hasHAnchor ? (p.husbandPayAnchor ?? null) : null,
    wifePayAutoLog: hasWAuto ? Boolean(p.wifePayAutoLog) : false,
    wifeBiweeklyPayAnchor: hasWAnchor ? (p.wifeBiweeklyPayAnchor ?? null) : null,
  };
  return migrateOtherPlannedIncome(merged);
};

export const normalizeSavingsGoals = (state: FinanceState): FinanceState => {
  const ef = Math.max(0, Number(state.emergencyFund) || 0);
  if (state.savingsGoals?.length) {
    const next = state.savingsGoals.map((g) => {
      if (g.id !== 'legacy-three-month') return g;
      const tgt = Math.max(0, Number(g.targetAmount) || 0);
      const stored = Math.max(0, Number(g.balance) || 0);
      const mirrorCap = Math.min(ef, tgt);
      // One-time cleanup: older builds mirrored emergencyFund into this balance on every load.
      const balance =
        stored > 0 && mirrorCap > 0 && Math.abs(stored - mirrorCap) < 0.01 && Math.abs(stored - ef) < 0.01
          ? 0
          : stored;
      return { ...g, name: g.name || '3-month cushion', balance, targetAmount: tgt };
    });
    return { ...state, savingsGoals: next };
  }
  const legacyTarget = Number(state.threeMonthFundTarget) || 0;
  if (legacyTarget > 0) {
    const goal: SavingsGoal = {
      id: 'legacy-three-month',
      name: '3-month cushion',
      targetAmount: legacyTarget,
      balance: Math.min(ef, legacyTarget),
    };
    return { ...state, savingsGoals: [goal] };
  }
  return { ...state, savingsGoals: [] };
};

const deepMerge = (base: FinanceState, partial: Partial<FinanceState>): FinanceState => ({
  ...base,
  ...partial,
  income: finalizeIncomeMergeForLoad(base.income, partial.income),
  allocation: { ...base.allocation, ...partial.allocation },
  wallets: { ...base.wallets, ...partial.wallets },
  essentials: partial.essentials !== undefined ? partial.essentials : base.essentials,
  debts: partial.debts !== undefined ? partial.debts : base.debts,
  billsPaid: partial.billsPaid !== undefined ? partial.billsPaid : base.billsPaid,
  billPaidAmounts: (() => {
    const b = { ...(base.billPaidAmounts ?? {}) };
    if (partial.billPaidAmounts === undefined) return b;
    const out: FinanceState['billPaidAmounts'] = { ...b };
    for (const [id, m] of Object.entries(partial.billPaidAmounts)) {
      out[id] = { ...(b[id] ?? {}), ...m };
    }
    return out;
  })(),
  billsAutoUnmarked:
    partial.billsAutoUnmarked !== undefined ? partial.billsAutoUnmarked : base.billsAutoUnmarked,
  incomeLog: partial.incomeLog !== undefined ? partial.incomeLog : base.incomeLog,
  extraIncome: partial.extraIncome !== undefined ? partial.extraIncome : base.extraIncome,
  surpriseExpenses:
    partial.surpriseExpenses !== undefined ? partial.surpriseExpenses : base.surpriseExpenses,
  budgetSurplusSweeps:
    partial.budgetSurplusSweeps !== undefined ? partial.budgetSurplusSweeps : base.budgetSurplusSweeps,
  monthSpendableCarryByMonth: (() => {
    const b = { ...(base.monthSpendableCarryByMonth ?? {}) };
    if (partial.monthSpendableCarryByMonth === undefined) return b;
    return { ...b, ...partial.monthSpendableCarryByMonth };
  })(),
  monthCashflowOpening: (() => {
    const b = { ...(base.monthCashflowOpening ?? {}) };
    if (partial.monthCashflowOpening === undefined) return b;
    return { ...b, ...partial.monthCashflowOpening };
  })(),
  plannedSavingsMonthly:
    partial.plannedSavingsMonthly !== undefined ? partial.plannedSavingsMonthly : base.plannedSavingsMonthly,
  plannedPersonalMonthly:
    partial.plannedPersonalMonthly !== undefined ? partial.plannedPersonalMonthly : base.plannedPersonalMonthly,
  savingsGoals: partial.savingsGoals !== undefined ? partial.savingsGoals : base.savingsGoals,
  billPaymentAttribution: (() => {
    const b = { ...(base.billPaymentAttribution ?? {}) };
    if (partial.billPaymentAttribution === undefined) return b;
    const out: NonNullable<FinanceState['billPaymentAttribution']> = { ...b };
    for (const [id, m] of Object.entries(partial.billPaymentAttribution)) {
      out[id] = { ...(b[id] ?? {}), ...m };
    }
    return out;
  })(),
});

/**
 * Legacy saves only had savings/personal as % of pay. If those keys are absent from stored JSON,
 * derive starting dollars from allocation % × current pay; otherwise keep merged values.
 */
const ensurePlannedMonthlyDollars = (state: FinanceState, raw?: Partial<FinanceState>): FinanceState => {
  const fromPct = (pct: number) => (Math.max(0, pct) / 100) * combinedMonthlyIncome(state);
  const missingS = Boolean(raw && !Object.prototype.hasOwnProperty.call(raw, 'plannedSavingsMonthly'));
  const missingP = Boolean(raw && !Object.prototype.hasOwnProperty.call(raw, 'plannedPersonalMonthly'));
  return {
    ...state,
    plannedSavingsMonthly: missingS
      ? fromPct(state.allocation.savings)
      : Math.max(0, Number(state.plannedSavingsMonthly) || 0),
    plannedPersonalMonthly: missingP
      ? fromPct(state.allocation.personal)
      : Math.max(0, Number(state.plannedPersonalMonthly) || 0),
  };
};

const resetWalletsIfNewMonth = (s: FinanceState): FinanceState => {
  const cm = currentMonthKey();
  if (s.walletResetMonth === cm) return s;
  return {
    ...s,
    walletResetMonth: cm,
    wallets: { ...s.wallets, husbandSpent: 0, wifeSpent: 0 },
  };
};

/** First load after upgrading: old JSON lacked `monthCashflowOpening`; stamp current month silently so nobody is trapped. */
const silentlyBackfillMonthCashflowOpeningForLegacySave = (
  state: FinanceState,
  rawParsed: Partial<FinanceState>,
): FinanceState => {
  const legacy = !Object.prototype.hasOwnProperty.call(rawParsed, 'monthCashflowOpening');
  if (!legacy) return state;
  const mk = currentMonthKey();
  if (!hasMeaningfulFinanceTouch(state)) return state;
  const prev = previousCalendarMonthKey(mk);
  const S = surplusSweepRoomRemaining(state, prev);
  const C = monthSpendableCarry(state, mk);
  const roundedS = Math.round(S * 100) / 100;
  const roundedC = Math.round(C * 100) / 100;
  const savingsDirected = Math.max(0, Math.round((S - C) * 100) / 100);
  const seal: MonthCashflowOpening = {
    confirmedAt: new Date().toISOString().slice(0, 10),
    forMonthKey: mk,
    settledFromPriorMonthKey: prev,
    priorSurplusRemainderShown: roundedS,
    savingsDirectedAway: savingsDirected,
    carryApplied: roundedC,
    migrated: true,
  };
  return {
    ...state,
    monthCashflowOpening: { ...(state.monthCashflowOpening ?? {}), [mk]: seal },
  };
};

const normalizeLoadedState = (base: FinanceState, parsed?: Partial<FinanceState>): FinanceState => {
  if (!parsed) return applyAutoScheduledPayLogs(applyAutoMarkHandled(base));
  const merged = deepMerge(base, parsed);
  const withPlanned = ensurePlannedMonthlyDollars(merged, parsed);
  const migrated = stripLegacyWeeklyEssentialMonthKeys(withPlanned);
  const pruned = prunePreTrackingBillKeys(migrated);
  const withMonth = resetWalletsIfNewMonth(pruned);
  const legacyOpening = silentlyBackfillMonthCashflowOpeningForLegacySave(withMonth, parsed);
  const withGoals = normalizeSavingsGoals(legacyOpening);
  const withAuto = applyAutoScheduledPayLogs(applyAutoMarkHandled(withGoals));
  return { ...withAuto, theme: loadThemePreference() };
};

/** Theme is per-device only — do not sync appearance across web / Android / iOS. */
export function stateForServerSync(state: FinanceState): FinanceState {
  return { ...state, theme: 'system' };
}

export const SERVER_CACHE_KEY = 'finance-server-cache-v1';

function serverRequestHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${serverAuthBearer()}`,
    'X-Client-Platform': getClientPlatform(),
  };
}

export const getServerStorageConfig = (
  opts?: { force?: boolean },
): {
  enabled: boolean;
  baseUrl: string;
  secret: string;
  householdId: string;
} => {
  const cfg = readNotifyRelayConfig();
  const url = (cfg.url ?? '').trim() || resolveNotifyRelayUrl();
  // Native builds must use absolute API host (Capacitor WebView origin is localhost).
  const baseUrl = resolveHouseholdApiBase();

  const sess = readHouseholdSession();
  const householdId = (sess?.householdId?.trim() || ensureNotifyRelayHouseholdId());
  const sessionOk = Boolean(sess?.token && sess.householdId);
  const secretOk = Boolean((cfg.secret ?? '').trim());
  const canAuth = secretOk || sessionOk;
  const ready = Boolean(baseUrl || url) && Boolean(householdId) && canAuth;
  // Signed-in households always sync to server; notify toggle only gates email relay.
  const syncOn =
    opts?.force === true || Boolean(cfg.enabled) || sessionOk;
  return {
    enabled: ready && syncOn,
    baseUrl,
    secret: cfg.secret,
    householdId,
  };
};

export const fetchServerFinanceState = async (
  opts?: { force?: boolean },
): Promise<
  | { ok: true; state: FinanceState; updatedAt: string }
  | { ok: false; status: number; error: string }
> => {
  const base = defaultFinanceState();
  const c = getServerStorageConfig(opts);
  if (!c.enabled) return { ok: false, status: 0, error: 'Server storage not configured' };

  const path = `/v1/state?id=${encodeURIComponent(c.householdId)}`;
  const res = await householdApiFetch(path, {
    method: 'GET',
    headers: serverRequestHeaders(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) {
      clearHouseholdSession();
    }
    return { ok: false, status: res.status, error: t || res.statusText };
  }
  const j = (await res.json()) as { state?: Partial<FinanceState>; updatedAt?: string };
  const normalized = normalizeLoadedState(base, (j.state ?? {}) as Partial<FinanceState>);
  return { ok: true, state: normalized, updatedAt: String(j.updatedAt ?? '') };
};

export const fetchServerStateMeta = async (
  opts?: { force?: boolean },
): Promise<
  | { ok: true; updatedAt: string | null; exists: boolean }
  | { ok: false; status: number; error: string }
> => {
  const c = getServerStorageConfig(opts);
  if (!c.enabled) return { ok: false, status: 0, error: 'Server storage not configured' };

  const path = `/v1/state/meta?id=${encodeURIComponent(c.householdId)}`;
  const res = await householdApiFetch(path, { method: 'GET', headers: serverRequestHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) clearHouseholdSession();
    return { ok: false, status: res.status, error: t || res.statusText };
  }
  const j = (await res.json()) as { updatedAt?: string | null; exists?: boolean };
  const raw = j.updatedAt;
  const updatedAt =
    raw === null || raw === undefined ? null : typeof raw === 'string' ? raw : String(raw);
  return { ok: true, updatedAt, exists: Boolean(j.exists) };
};

const WATCH_WAIT_SEC = 25;

/** Long-poll until server workbook version changes (for live cross-device sync). */
export const watchServerStateChanges = async (
  since: string | null,
  opts?: { force?: boolean; signal?: AbortSignal },
): Promise<
  | { ok: true; changed: boolean; updatedAt: string | null; exists: boolean }
  | { ok: false; status: number; error: string }
> => {
  const c = getServerStorageConfig(opts);
  if (!c.enabled) return { ok: false, status: 0, error: 'Server storage not configured' };

  const params = new URLSearchParams({
    id: c.householdId,
    wait: String(WATCH_WAIT_SEC),
  });
  if (since) params.set('since', since);

  const path = `/v1/state/watch?${params}`;
  const res = await householdApiFetch(path, {
    method: 'GET',
    headers: serverRequestHeaders(),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) clearHouseholdSession();
    return { ok: false, status: res.status, error: t || res.statusText };
  }
  const j = (await res.json()) as {
    changed?: boolean;
    updatedAt?: string | null;
    exists?: boolean;
  };
  const raw = j.updatedAt;
  const updatedAt =
    raw === null || raw === undefined ? null : typeof raw === 'string' ? raw : String(raw);
  return {
    ok: true,
    changed: Boolean(j.changed),
    updatedAt,
    exists: Boolean(j.exists),
  };
};

export const putServerFinanceState = async (
  state: FinanceState,
  opts?: { force?: boolean; baseUpdatedAt?: string | null; notify?: boolean; widgetCacheV1?: unknown },
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; status: number; error: string; conflict?: boolean }
> => {
  const c = getServerStorageConfig(opts);
  if (!c.enabled) return { ok: false, status: 0, error: 'Server storage not configured' };
  const path = `/v1/state?id=${encodeURIComponent(c.householdId)}`;
  const body: { state: FinanceState; baseUpdatedAt?: string; force?: boolean; notify?: boolean; widgetCacheV1?: unknown } = {
    state: stateForServerSync(state),
  };
  if (opts?.baseUpdatedAt) body.baseUpdatedAt = opts.baseUpdatedAt;
  if (opts?.force) body.force = true;
  if (opts?.notify === true) body.notify = true;
  if (opts?.widgetCacheV1) body.widgetCacheV1 = opts.widgetCacheV1;
  const res = await householdApiFetch(path, {
    method: 'PUT',
    headers: { ...serverRequestHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) {
      clearHouseholdSession();
    }
    if (res.status === 409) {
      return { ok: false, status: 409, error: 'Another device saved newer changes.', conflict: true };
    }
    return { ok: false, status: res.status, error: t || res.statusText };
  }
  const j = (await res.json()) as { updatedAt?: string };
  return { ok: true, updatedAt: String(j.updatedAt ?? '') };
};

export const loadFinanceState = (): FinanceState => {
  const base = defaultFinanceState();
  try {
    const cache = localStorage.getItem(SERVER_CACHE_KEY);
    if (cache) {
      const parsed = JSON.parse(cache) as Partial<FinanceState>;
      return normalizeLoadedState(base, parsed);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeLoadedState(base);
    const parsed = JSON.parse(raw) as Partial<FinanceState>;
    return normalizeLoadedState(base, parsed);
  } catch {
    return normalizeLoadedState(base);
  }
};

export const saveFinanceState = (s: FinanceState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    // Keep a cache for server-first mode/offline startup.
    localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
};

export { STORAGE_KEY };
