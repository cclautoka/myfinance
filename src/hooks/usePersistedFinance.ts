import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultFinanceState } from '../data/defaults';
import {
  fetchServerFinanceState,
  fetchServerStateMeta,
  watchServerStateChanges,
  getServerStorageConfig,
  loadFinanceState,
  putServerFinanceState,
  saveFinanceState,
} from '../data/storage';
import { getClientPlatform } from '../utils/clientPlatform';
import type { BillPaymentAttribution } from '../types/finance';
import type {
  AllocationPercents,
  DebtAccount,
  EssentialExpense,
  ExtraIncomeEntry,
  FinanceState,
  IncomeLogEntry,
  SurpriseExpenseEntry,
  ThemePreference,
} from '../types/finance';
import { currentMonthKey, previousCalendarMonthKey } from '../data/defaults';
import { debtIsAutoDeduction } from '../utils/autoBills';
import type { BillsPaidTogglePayload } from '../utils/billsTimeline';
import { billPaymentKey } from '../utils/billsTimeline';
import { applyAutoScheduledPayLogs } from '../utils/autoScheduledPayLog';
import { surplusSweepRoomRemaining } from '../utils/budgetSurplus';
import {
  buildSaveEmailDigest,
  buildSnapshotForReminders,
  pocketLeftSoFar,
  postNotifyRelay,
  postSnapshotRelay,
} from '../utils/notifyRelay';
import { readHouseholdSession } from '../utils/householdSession';
import { readNotifyRelayConfig } from '../utils/notifyRelayConfig';
import { serverAuthBearer } from '../utils/serverAuth';
import {
  markHouseholdSetupFinished,
  maybeMigrateLegacyHouseholdSetup,
  tryCompleteSetupFromServerState,
} from '../setup/setupCompletion';
import { pushToast } from '../ui/toast/toastBus';

const round2 = (n: number) => Math.round(n * 100) / 100;

function hashFinanceState(s: FinanceState): string {
  try {
    const str = JSON.stringify(s);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return String(h >>> 0);
  } catch {
    return '';
  }
}

function diffTouchesOnlySurprises(from: FinanceState, to: FinanceState): boolean {
  const f = { ...from, surpriseExpenses: to.surpriseExpenses };
  const t = { ...to, surpriseExpenses: from.surpriseExpenses };
  return hashFinanceState(f) === hashFinanceState(to) && hashFinanceState(t) === hashFinanceState(from);
}

function notifyRelayCanSend(cfg: ReturnType<typeof readNotifyRelayConfig>): boolean {
  if (!cfg.enabled || !cfg.url) return false;
  if (cfg.secret.trim()) return true;
  return Boolean(readHouseholdSession()?.token);
}

function serverTimeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function isRemoteNewer(remoteAt: string | null, localAt: string | null): boolean {
  if (!remoteAt) return false;
  if (!localAt) return true;
  return serverTimeMs(remoteAt) > serverTimeMs(localAt);
}

export function usePersistedFinance() {
  const [state, setState] = useState<FinanceState>(() => loadFinanceState());
  const [isServerSyncing, setIsServerSyncing] = useState(() => Boolean(readHouseholdSession()?.token));
  const [serverWorkbookExists, setServerWorkbookExists] = useState(false);
  const [serverHydrationError, setServerHydrationError] = useState<string | null>(null);
  const [syncConflict, setSyncConflict] = useState(false);
  const stateRef = useRef(state);
  /** Skip one debounced PUT right after hydrating from server (avoids redundant write-back on load). */
  const skipNextServerSaveRef = useRef(false);
  /** Skip arming notify debounce right after hydrate (avoids spurious email timer on login). */
  const skipNextNotifyRef = useRef(false);
  const lastKnownServerUpdatedAtRef = useRef<string | null>(null);
  const lastSyncedStateHashRef = useRef<string>(hashFinanceState(loadFinanceState()));
  const pollInFlightRef = useRef(false);
  const serverSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const resaveAfterFlightRef = useRef(false);
  /** Block debounced PUT until first server hydration finishes (avoids stale local overwriting server). */
  const serverHydratedRef = useRef(false);

  const HOUSEHOLD_SAVED_TOAST = 'Household workbook saved.';

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const markServerSynced = useCallback((updatedAt: string, syncedState: FinanceState) => {
    if (updatedAt) lastKnownServerUpdatedAtRef.current = updatedAt;
    lastSyncedStateHashRef.current = hashFinanceState(syncedState);
    setSyncConflict(false);
  }, []);

  /** Block auto-pull while a save is queued or in flight. */
  const isClientDirty = useCallback(
    () => serverSaveRef.current !== null || saveInFlightRef.current,
    [],
  );

  const applyRemoteState = useCallback(
    (remoteState: FinanceState, updatedAt: string, opts?: { toast?: boolean; toastMessage?: string }) => {
      skipNextServerSaveRef.current = true;
      skipNextNotifyRef.current = true;
      setState(remoteState);
      stateRef.current = remoteState;
      const relayCfg = readNotifyRelayConfig();
      maybeMigrateLegacyHouseholdSetup(remoteState, relayCfg);
      tryCompleteSetupFromServerState(remoteState, relayCfg);
      markServerSynced(updatedAt, remoteState);
      if (opts?.toast) {
        pushToast({
          type: 'success',
          message: opts.toastMessage ?? 'Updated from another device.',
        });
      }
    },
    [markServerSynced],
  );

  useEffect(() => {
    if (!readHouseholdSession()?.token) return;
    saveFinanceState(state);
  }, [state]);

  /** Server hydration when signed in (server is source of truth). */
  useEffect(() => {
    if (!readHouseholdSession()?.token) return;
    const cfg = getServerStorageConfig();
    if (!cfg.enabled) {
      serverHydratedRef.current = true;
      setIsServerSyncing(false);
      return;
    }

    let cancelled = false;
    serverHydratedRef.current = false;
    setIsServerSyncing(true);
    setServerHydrationError(null);
    setServerWorkbookExists(false);
    (async () => {
      try {
        const meta = await fetchServerStateMeta();
        if (cancelled) return;
        if (meta.ok && meta.exists) {
          setServerWorkbookExists(true);
          const relayCfg = readNotifyRelayConfig();
          markHouseholdSetupFinished(relayCfg.householdId);
        }

        const remote = await fetchServerFinanceState();
        if (cancelled) return;
        if (remote.ok) {
          setServerHydrationError(null);
          setServerWorkbookExists(true);
          if (serverSaveRef.current !== null) {
            clearTimeout(serverSaveRef.current);
            serverSaveRef.current = null;
          }
          applyRemoteState(remote.state, remote.updatedAt);
          const relayCfg = readNotifyRelayConfig();
          if (relayCfg.enabled && relayCfg.url && serverAuthBearer()) {
            void postSnapshotRelay(buildSnapshotForReminders(remote.state)).then((r) => {
              if (!r.ok && typeof console !== 'undefined') {
                console.warn('[notify relay snapshot on login]', r.error);
              }
            });
          }
        } else if (!remote.ok) {
          const hasServerRow = meta.ok && meta.exists;
          if (!hasServerRow) {
            const err =
              remote.status === 404
                ? 'No saved workbook on the server for this household yet.'
                : remote.error || 'Could not load your household from the server.';
            setServerHydrationError(err);
            if (typeof console !== 'undefined') console.warn('[server hydrate]', err);
          } else {
            pushToast({
              type: 'error',
              message:
                'Workbook is on the server but could not load details. Pull to refresh or use Tools → Reload from server.',
            });
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        setServerHydrationError(err);
        if (typeof console !== 'undefined') console.warn('[server hydrate]', err);
      } finally {
        serverHydratedRef.current = true;
        if (!cancelled) setIsServerSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsServerSyncing(false);
    };
  }, [applyRemoteState]);

  const reloadFromServer = useCallback(async () => {
    const cfg = getServerStorageConfig({ force: true });
    if (!cfg.enabled) {
      const error = 'Server storage not configured yet (URL + secret + household id).';
      pushToast({ type: 'error', message: error });
      return { ok: false as const, error };
    }
    const remote = await fetchServerFinanceState({ force: true });
    if (!remote.ok) {
      const error =
        remote.status === 404
          ? 'No server data found for this household id yet.'
          : remote.error || 'Failed to load server data.';
      pushToast({ type: 'error', message: error });
      return { ok: false as const, error };
    }
    applyRemoteState(remote.state, remote.updatedAt);
    pushToast({ type: 'success', message: 'Synced from server.' });
    return { ok: true as const, updatedAt: remote.updatedAt };
  }, [applyRemoteState]);

  const dismissSyncConflict = useCallback(() => {
    setSyncConflict(false);
  }, []);

  const checkRemoteAndMaybeApply = useCallback(async () => {
    if (!readHouseholdSession()?.token) return;
    const cfg = getServerStorageConfig();
    if (!cfg.enabled || pollInFlightRef.current) return;

    pollInFlightRef.current = true;
    try {
      const meta = await fetchServerStateMeta();
      if (!meta.ok) return;
      const remoteAt = meta.updatedAt;
      const localAt = lastKnownServerUpdatedAtRef.current;
      if (!isRemoteNewer(remoteAt, localAt)) return;

      if (isClientDirty()) {
        setSyncConflict(true);
        return;
      }

      const remote = await fetchServerFinanceState();
      if (!remote.ok) return;
      if (!isRemoteNewer(remote.updatedAt, localAt)) return;
      applyRemoteState(remote.state, remote.updatedAt, {
        toast: true,
        toastMessage: 'Updated from another device.',
      });
    } catch {
      /* offline */
    } finally {
      pollInFlightRef.current = false;
    }
  }, [applyRemoteState, isClientDirty]);

  /** Live sync: long-poll while visible + fast meta poll fallback. */
  useEffect(() => {
    if (!readHouseholdSession()?.token) return;
    const cfg = getServerStorageConfig();
    if (!cfg.enabled) return;

    let stopped = false;
    let watchAbort = new AbortController();

    const isActive = () =>
      document.visibilityState === 'visible' || Capacitor.isNativePlatform();

    const pullIfVisible = () => {
      if (stopped || !isActive()) return;
      void checkRemoteAndMaybeApply();
    };

    const startWatchLoop = () => {
      watchAbort.abort();
      watchAbort = new AbortController();
      const signal = watchAbort.signal;
      void (async () => {
        while (!stopped && isActive() && !signal.aborted) {
          try {
            const w = await watchServerStateChanges(lastKnownServerUpdatedAtRef.current, { signal });
            if (stopped || signal.aborted) return;
            if (w.ok && w.changed) {
              await checkRemoteAndMaybeApply();
            }
          } catch (err) {
            if (stopped || signal.aborted) return;
            const msg = err instanceof Error ? err.message : String(err);
            if (!/abort/i.test(msg)) {
              await new Promise((r) => setTimeout(r, 1500));
            }
          }
        }
      })();
    };

    const stopWatchLoop = () => watchAbort.abort();

    startWatchLoop();
    pullIfVisible();

    const onFocus = () => pullIfVisible();
    const onVis = () => {
      if (isActive()) {
        pullIfVisible();
        startWatchLoop();
      } else if (!Capacitor.isNativePlatform()) {
        stopWatchLoop();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    if (Capacitor.isNativePlatform()) {
      window.addEventListener('pageshow', onFocus);
    }
    const fastPoll = window.setInterval(pullIfVisible, 3000);

    return () => {
      stopped = true;
      stopWatchLoop();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      if (Capacitor.isNativePlatform()) {
        window.removeEventListener('pageshow', onFocus);
      }
      window.clearInterval(fastPoll);
    };
  }, [checkRemoteAndMaybeApply]);

  /** Server persistence (debounced) — local cache is written in saveFinanceState above. */
  const lastSaveErrorToastRef = useRef<{ message: string; at: number } | null>(null);

  const flushServerSave = useCallback(
    async (opts?: { force?: boolean; notify?: boolean }) => {
      if (!readHouseholdSession()?.token) return;
      const cfg = getServerStorageConfig();
      if (!cfg.enabled) return;
      if (!serverHydratedRef.current) return;
      if (saveInFlightRef.current) {
        resaveAfterFlightRef.current = true;
        return;
      }
      if (serverSaveRef.current !== null) {
        clearTimeout(serverSaveRef.current);
        serverSaveRef.current = null;
      }

      const baseUpdatedAt = opts?.force ? null : lastKnownServerUpdatedAtRef.current;
      saveInFlightRef.current = true;
      try {
        const result = await putServerFinanceState(stateRef.current, {
          baseUpdatedAt,
          force: opts?.force,
        });
        if (result.ok) {
          lastSaveErrorToastRef.current = null;
          markServerSynced(result.updatedAt, stateRef.current);
          if (opts?.notify !== false) {
            pushToast({ type: 'success', message: HOUSEHOLD_SAVED_TOAST });
          }
          return;
        }
        if (result.conflict) {
          setSyncConflict(true);
          const conflictMsg =
            'Could not save — another device saved first. Reload from server or save this device.';
          pushToast({ type: 'error', message: conflictMsg });
          return;
        }
        const message = Capacitor.isNativePlatform()
          ? 'Could not save to server (check Wi‑Fi and redeploy API with PUT allowed in CORS). Changes stay on this device.'
          : 'Could not save to server. Changes are stored on this device.';
        const now = Date.now();
        const prev = lastSaveErrorToastRef.current;
        if (!prev || prev.message !== message || now - prev.at >= 10_000) {
          lastSaveErrorToastRef.current = { message, at: now };
          pushToast({ type: 'error', message });
        }
      } finally {
        saveInFlightRef.current = false;
        if (resaveAfterFlightRef.current) {
          resaveAfterFlightRef.current = false;
          void flushServerSave(opts);
        }
      }
    },
    [markServerSynced],
  );

  const forcePushLocalToServer = useCallback(async () => {
    setSyncConflict(false);
    await flushServerSave({ force: true, notify: true });
  }, [flushServerSave]);

  useEffect(() => {
    if (!readHouseholdSession()?.token) return;
    const cfg = getServerStorageConfig();
    if (!cfg.enabled) return;
    if (!serverHydratedRef.current) return;
    if (skipNextServerSaveRef.current) {
      skipNextServerSaveRef.current = false;
      return;
    }
    if (serverSaveRef.current !== null) clearTimeout(serverSaveRef.current);
    serverSaveRef.current = setTimeout(() => {
      serverSaveRef.current = null;
      void flushServerSave({ notify: true });
    }, 400);
    return () => {
      if (serverSaveRef.current !== null) clearTimeout(serverSaveRef.current);
    };
  }, [state, flushServerSave]);

  /** Flush only a pending user save when leaving the tab — never push stale cache on blur. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && serverSaveRef.current !== null) {
        void flushServerSave();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [flushServerSave]);

  /** Re-check wife biweekly auto-log when the tab regains focus (after server poll). */
  useEffect(() => {
    const runAutoLog = () =>
      setState((s) => {
        const next = applyAutoScheduledPayLogs(s, new Date());
        return next.incomeLog === s.incomeLog ? s : next;
      });
    runAutoLog();
    const onFocus = () => {
      void checkRemoteAndMaybeApply().finally(() => runAutoLog());
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void checkRemoteAndMaybeApply().finally(() => runAutoLog());
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [checkRemoteAndMaybeApply]);

  const update = useCallback((patch: Partial<FinanceState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const setIncome = useCallback((income: FinanceState['income']) => {
    setState((s) => ({ ...s, income }));
  }, []);

  const setEssentials = useCallback((essentials: EssentialExpense[]) => {
    setState((s) => ({ ...s, essentials }));
  }, []);

  const setDebts = useCallback((debts: DebtAccount[]) => {
    setState((s) => ({ ...s, debts }));
  }, []);

  const setAllocation = useCallback((allocation: AllocationPercents) => {
    setState((s) => ({ ...s, allocation }));
  }, []);

  const setWallets = useCallback((wallets: FinanceState['wallets']) => {
    setState((s) => ({ ...s, wallets }));
  }, []);

  const setEmergency = useCallback((emergencyFund: number) => {
    setState((s) => ({ ...s, emergencyFund }));
  }, []);

  const setThreeMonthTarget = useCallback((threeMonthFundTarget: number) => {
    setState((s) => ({ ...s, threeMonthFundTarget }));
  }, []);

  const setTheme = useCallback((theme: ThemePreference) => {
    setState((s) => ({ ...s, theme }));
  }, []);

  /** One timeline row at a time — weekly essentials use one key per due day; debts use YYYY-MM. */
  const toggleBillPaid = useCallback((row: BillsPaidTogglePayload) => {
    const payKeyPreview = billPaymentKey(stateRef.current, row);
    const wasPaid = (stateRef.current.billsPaid[row.billId] ?? []).includes(payKeyPreview);
    setState((s) => {
      const payKey = billPaymentKey(s, row);
      const { billId, actualPaid } = row;
      const cur = new Set(s.billsPaid[billId] ?? []);
      if (wasPaid) cur.delete(payKey);
      else cur.add(payKey);

      const billsAutoUnmarked = { ...(s.billsAutoUnmarked ?? {}) };
      if (debtIsAutoDeduction(s.debts, billId)) {
        const unset = new Set(billsAutoUnmarked[billId] ?? []);
        if (wasPaid) {
          unset.add(payKey);
        } else {
          unset.delete(payKey);
        }
        billsAutoUnmarked[billId] = [...unset];
      }

      const billPaidAmounts = { ...(s.billPaidAmounts ?? {}) };
      const inner = { ...(billPaidAmounts[billId] ?? {}) };
      if (wasPaid) {
        delete inner[payKey];
      } else {
        const amt = typeof actualPaid === 'number' && Number.isFinite(actualPaid) ? actualPaid : undefined;
        if (amt !== undefined && amt >= 0) inner[payKey] = amt;
      }
      billPaidAmounts[billId] = inner;

      const billPaymentAttribution = { ...(s.billPaymentAttribution ?? {}) };
      const attrInner = { ...(billPaymentAttribution[billId] ?? {}) };
      if (wasPaid) {
        delete attrInner[payKey];
      } else {
        const sess = readHouseholdSession();
        const role = sess?.role === 'partner' ? 'partner' : 'owner';
        const entry: BillPaymentAttribution = {
          role,
          memberEmail: sess?.email,
          platform: getClientPlatform(),
          at: new Date().toISOString(),
        };
        attrInner[payKey] = entry;
      }
      if (Object.keys(attrInner).length) billPaymentAttribution[billId] = attrInner;
      else delete billPaymentAttribution[billId];

      const next = {
        ...s,
        billsPaid: { ...s.billsPaid, [billId]: [...cur] },
        billsAutoUnmarked,
        billPaidAmounts,
        billPaymentAttribution,
      };
      stateRef.current = next;
      return next;
    });
    if (serverSaveRef.current !== null) {
      clearTimeout(serverSaveRef.current);
      serverSaveRef.current = null;
    }
    void flushServerSave({ notify: true });
  }, [flushServerSave]);

  const addExtraIncome = useCallback((entry: ExtraIncomeEntry) => {
    setState((s) => ({ ...s, extraIncome: [entry, ...s.extraIncome] }));
    const label = entry.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Added extra income “${label}”.` : 'Added extra income.',
    });
  }, []);

  const removeExtraIncome = useCallback((id: string) => {
    const entry = stateRef.current.extraIncome.find((e) => e.id === id);
    setState((s) => ({ ...s, extraIncome: s.extraIncome.filter((e) => e.id !== id) }));
    const label = entry?.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Removed extra income “${label}”.` : 'Removed extra income.',
    });
  }, []);

  const addSurpriseExpense = useCallback((entry: SurpriseExpenseEntry) => {
    setState((s) => ({ ...s, surpriseExpenses: [entry, ...s.surpriseExpenses] }));
    const label = entry.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Added surprise expense “${label}”.` : 'Added surprise expense.',
    });
  }, []);

  const removeSurpriseExpense = useCallback((id: string) => {
    const entry = stateRef.current.surpriseExpenses.find((e) => e.id === id);
    setState((s) => ({
      ...s,
      surpriseExpenses: s.surpriseExpenses.filter((e) => e.id !== id),
    }));
    const label = entry?.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Removed surprise expense “${label}”.` : 'Removed surprise expense.',
    });
  }, []);

  const addIncomeLog = useCallback((entry: IncomeLogEntry) => {
    setState((s) => ({ ...s, incomeLog: [entry, ...s.incomeLog] }));
    const label = entry.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Logged paycheque “${label}”.` : 'Logged paycheque.',
    });
  }, []);

  const removeIncomeLog = useCallback((id: string) => {
    const entry = stateRef.current.incomeLog.find((e) => e.id === id);
    setState((s) => ({ ...s, incomeLog: s.incomeLog.filter((e) => e.id !== id) }));
    const label = entry?.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Removed paycheque “${label}”.` : 'Removed paycheque.',
    });
  }, []);

  const updateIncomeLog = useCallback((id: string, patch: Partial<IncomeLogEntry>) => {
    setState((s) => ({
      ...s,
      incomeLog: s.incomeLog.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const updateExtraIncome = useCallback((id: string, patch: Partial<ExtraIncomeEntry>) => {
    setState((s) => ({
      ...s,
      extraIncome: s.extraIncome.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const updateSurpriseExpense = useCallback((id: string, patch: Partial<SurpriseExpenseEntry>) => {
    setState((s) => ({
      ...s,
      surpriseExpenses: s.surpriseExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const setMonthSpendableCarry = useCallback((monthKey: string, amount: number) => {
    const n = round2(Number(amount));
    const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
    setState((s) => {
      const prev = { ...(s.monthSpendableCarryByMonth ?? {}) };
      if (safe <= 0) delete prev[monthKey];
      else prev[monthKey] = safe;
      return { ...s, monthSpendableCarryByMonth: prev };
    });
  }, []);

  /**
   * Confirm month opening: move `savingsDirectedAway` off prior-month slack, roll the rest into this month’s typed carry-in.
   */
  const completeMonthCashflowOpening = useCallback((savingsDirectedAwayRaw: number) => {
    setState((s) => {
      const mk = currentMonthKey();
      const prev = previousCalendarMonthKey(mk);
      const slack = surplusSweepRoomRemaining(s, prev);
      let sav = round2(Number(savingsDirectedAwayRaw));
      if (!Number.isFinite(sav)) sav = 0;
      sav = Math.max(0, Math.min(sav, slack));
      const carry = round2(Math.max(0, slack - sav));
      const today = new Date().toISOString().slice(0, 10);
      const carryMap = { ...(s.monthSpendableCarryByMonth ?? {}) };
      if (carry <= 0) delete carryMap[mk];
      else carryMap[mk] = carry;
      return {
        ...s,
        monthSpendableCarryByMonth: carryMap,
        monthCashflowOpening: {
          ...(s.monthCashflowOpening ?? {}),
          [mk]: {
            confirmedAt: today,
            forMonthKey: mk,
            settledFromPriorMonthKey: prev,
            priorSurplusRemainderShown: round2(slack),
            savingsDirectedAway: sav,
            carryApplied: carry,
          },
        },
      };
    });
  }, []);

  /** Move cashflow slack into emergency fund (incl. optional carry‑in); capped by net − prior sweeps this month. */
  const applyBudgetSurplusToEmergency = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const id = Math.random().toString(36).slice(2, 12);
    const today = new Date().toISOString().slice(0, 10);
    setState((s) => {
      const mk = currentMonthKey();
      const room = surplusSweepRoomRemaining(s, mk);
      const amt = Math.min(amount, room);
      if (amt <= 0) return s;
      return {
        ...s,
        emergencyFund: s.emergencyFund + amt,
        budgetSurplusSweeps: [...(s.budgetSurplusSweeps ?? []), { id, monthKey: mk, amount: amt, date: today }],
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(defaultFinanceState());
  }, []);

  /** Optional: POST summary to self-hosted notify API (Dokploy) ~60s after last local change. */
  const notifyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifyBaselineRef = useRef<string | null>(null);
  const prevStateRef = useRef(state);
  const notifyWindowFromRef = useRef<FinanceState | null>(null);

  useEffect(() => {
    const h = hashFinanceState(state);
    const prev = prevStateRef.current;

    if (notifyBaselineRef.current === null) {
      notifyBaselineRef.current = h;
      prevStateRef.current = state;
      return;
    }
    if (skipNextNotifyRef.current) {
      skipNextNotifyRef.current = false;
      notifyBaselineRef.current = h;
      prevStateRef.current = state;
      return;
    }
    if (notifyBaselineRef.current === h) {
      prevStateRef.current = state;
      return;
    }

    const surpriseOnly = diffTouchesOnlySurprises(prev, state);
    const debounceMs = surpriseOnly ? 15_000 : 60_000;

    const hadTimer = notifyDebounceRef.current !== null;
    if (notifyDebounceRef.current !== null) clearTimeout(notifyDebounceRef.current);
    if (!hadTimer) {
      try {
        notifyWindowFromRef.current = structuredClone(prev);
      } catch {
        notifyWindowFromRef.current = prev;
      }
    }
    notifyBaselineRef.current = h;

    notifyDebounceRef.current = setTimeout(() => {
      notifyDebounceRef.current = null;
      const cfg = readNotifyRelayConfig();
      if (!notifyRelayCanSend(cfg)) {
        notifyWindowFromRef.current = null;
        return;
      }
      const latest = stateRef.current;
      const from = notifyWindowFromRef.current ?? prev;
      notifyWindowFromRef.current = null;

      const digest = buildSaveEmailDigest(from, latest);
      if (digest) {
        const mk = currentMonthKey();
        const pocket = pocketLeftSoFar(latest);
        void postNotifyRelay('', { digest, monthKey: mk, pocketLeft: pocket }).then((r) => {
          if (!r.ok) {
            if (typeof console !== 'undefined') console.warn('[notify relay]', r.error);
            pushToast({
              type: 'error',
              message: `Change summary email failed: ${r.error}`.slice(0, 240),
            });
          }
        });
      }
      void postSnapshotRelay(buildSnapshotForReminders(latest)).then((r) => {
        if (!r.ok) {
          if (typeof console !== 'undefined') console.warn('[notify relay snapshot]', r.error);
          pushToast({
            type: 'error',
            message: `Reminder snapshot failed: ${r.error}`.slice(0, 240),
          });
        }
      });
    }, debounceMs);

    prevStateRef.current = state;

    return () => {
      if (notifyDebounceRef.current !== null) clearTimeout(notifyDebounceRef.current);
    };
  }, [state]);

  return {
    state,
    isServerSyncing,
    syncConflict,
    dismissSyncConflict,
    forcePushLocalToServer,
    reloadFromServer,
    serverWorkbookExists,
    serverHydrationError,
    update,
    setIncome,
    setEssentials,
    setDebts,
    setAllocation,
    setWallets,
    setEmergency,
    setThreeMonthTarget,
    setTheme,
    toggleBillPaid,
    addExtraIncome,
    removeExtraIncome,
    addSurpriseExpense,
    removeSurpriseExpense,
    addIncomeLog,
    removeIncomeLog,
    updateIncomeLog,
    updateExtraIncome,
    updateSurpriseExpense,
    applyBudgetSurplusToEmergency,
    setMonthSpendableCarry,
    completeMonthCashflowOpening,
    resetAll,
  };
}
