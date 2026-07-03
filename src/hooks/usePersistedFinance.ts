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
import {
  billOccurrenceIsPaid,
  billPaymentKey,
  debtPaymentOccurrences,
  nextUnpaidDebtOccurrence,
  unpaidDebtContractRemaining,
} from '../utils/billsTimeline';
import { applyAutoScheduledPayLogs } from '../utils/autoScheduledPayLog';
import {
  monthPocketSlackForRollover,
  surplusSweepRoomRemaining,
  totalMonthOpeningAllocation,
  type MonthOpeningAllocationInput,
} from '../utils/budgetSurplus';
import { applyCardAvailableCheckIn } from '../utils/cardCredit';
import { effectiveDebtBalance, totalDebtRemaining } from '../utils/calculations';
import { estimatedDebtFreeMonths, simulateDebtPayoff } from '../utils/debtFree';
import { formatMoney } from '../utils/format';
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
import { loadThemePreference, saveThemePreference } from '../utils/themePreference';
import { writeWidgetCache } from '../utils/widgetCacheWriter';
import { buildWidgetCacheV1 } from '../utils/widgetCache';

const round2 = (n: number) => Math.round(n * 100) / 100;

function applyMarkAllUnpaidDebtOccurrences(s: FinanceState, debtId: string): FinanceState {
  const d = s.debts.find((x) => x.id === debtId);
  if (!d) return s;
  const occs = debtPaymentOccurrences(s, d);
  const sess = readHouseholdSession();
  const role = sess?.role === 'partner' ? 'partner' : 'owner';
  const entry: BillPaymentAttribution = {
    role,
    memberEmail: sess?.email,
    platform: getClientPlatform(),
    at: new Date().toISOString(),
  };

  const billsPaid = { ...s.billsPaid };
  const cur = new Set(billsPaid[debtId] ?? []);
  const billPaidAmounts = { ...(s.billPaidAmounts ?? {}) };
  const inner = { ...(billPaidAmounts[debtId] ?? {}) };
  const billPaymentAttribution = { ...(s.billPaymentAttribution ?? {}) };
  const attrInner = { ...(billPaymentAttribution[debtId] ?? {}) };

  for (const occ of occs) {
    if (billOccurrenceIsPaid(s, occ)) continue;
    const payKey = billPaymentKey(s, occ);
    cur.add(payKey);
    inner[payKey] = occ.amount;
    attrInner[payKey] = entry;
  }

  billsPaid[debtId] = [...cur];
  billPaidAmounts[debtId] = inner;
  if (Object.keys(attrInner).length) billPaymentAttribution[debtId] = attrInner;

  return { ...s, billsPaid, billPaidAmounts, billPaymentAttribution };
}

/** After a debt installment is marked paid, sync balance and finalize when nothing remains. */
function applySmartDebtPaymentFinalize(s: FinanceState, billId: string): FinanceState {
  const today = new Date().toISOString().slice(0, 10);
  const d = s.debts.find((x) => x.id === billId);
  if (!d) return s;

  let debts = s.debts;
  const ref = new Date();

  if (d.endsOn && d.monthlyPayment > 0 && d.balance > 0) {
    const unpaid = unpaidDebtContractRemaining(s, d);
    if (unpaid < d.balance) {
      debts = debts.map((x) =>
        x.id === billId ? { ...x, balance: round2(unpaid), balanceUpdatedAt: today } : x,
      );
    }
  }

  let next: FinanceState = { ...s, debts };
  const current = next.debts.find((x) => x.id === billId);
  if (!current) return next;

  if (effectiveDebtBalance(current, ref, next) === 0) {
    next = applyMarkAllUnpaidDebtOccurrences(next, billId);
    next = {
      ...next,
      debts: next.debts.map((x) =>
        x.id === billId ? { ...x, balance: 0, balanceUpdatedAt: today } : x,
      ),
    };
  }

  return next;
}

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
  const [state, setState] = useState<FinanceState>(() => {
    const loaded = loadFinanceState();
    return { ...loaded, theme: loadThemePreference() };
  });
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
    const h = hashFinanceState(syncedState);
    lastSyncedStateHashRef.current = h;
    lastSavedToastHashRef.current = h;
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
      const merged = { ...remoteState, theme: loadThemePreference() };
      setState(merged);
      stateRef.current = merged;
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

  // Native widgets need a shared-cache payload even when nothing changed yet.
  // Write once on mount (local cache) and again after the first server hydration.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void writeWidgetCache(stateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          // Ensure widgets have real data immediately after login hydration.
          void writeWidgetCache(remote.state);
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
    if (!serverHydratedRef.current) return;

    pollInFlightRef.current = true;
    try {
      const meta = await fetchServerStateMeta();
      if (!meta.ok) return;
      const remoteAt = meta.updatedAt;
      const localAt = lastKnownServerUpdatedAtRef.current;
      if (!isRemoteNewer(remoteAt, localAt)) return;

      if (isClientDirty()) {
        // No real local edits since last sync — cancel a queued debounced PUT and pull partner data.
        const noLocalEdits = hashFinanceState(stateRef.current) === lastSyncedStateHashRef.current;
        if (noLocalEdits && serverSaveRef.current !== null && !saveInFlightRef.current) {
          clearTimeout(serverSaveRef.current);
          serverSaveRef.current = null;
        } else if (saveInFlightRef.current) {
          return;
        } else {
          setSyncConflict(true);
          return;
        }
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
    const onNativeResume = () => pullIfVisible();
    window.addEventListener('finance-app-resume', onNativeResume);
    const fastPoll = window.setInterval(pullIfVisible, 3000);

    return () => {
      stopped = true;
      stopWatchLoop();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('finance-app-resume', onNativeResume);
      if (Capacitor.isNativePlatform()) {
        window.removeEventListener('pageshow', onFocus);
      }
      window.clearInterval(fastPoll);
    };
  }, [checkRemoteAndMaybeApply]);

  /** Server persistence (debounced) — local cache is written in saveFinanceState above. */
  const lastSaveErrorToastRef = useRef<{ message: string; at: number } | null>(null);
  const lastSavedToastHashRef = useRef<string | null>(null);

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
          notify: true,
          widgetCacheV1: buildWidgetCacheV1(stateRef.current, { householdId: readHouseholdSession()?.householdId }),
        });
        if (result.ok) {
          lastSaveErrorToastRef.current = null;
          markServerSynced(result.updatedAt, stateRef.current);
          if (opts?.notify !== false) {
            const savedHash = hashFinanceState(stateRef.current);
            if (savedHash !== lastSavedToastHashRef.current) {
              lastSavedToastHashRef.current = savedHash;
              pushToast({ type: 'success', message: HOUSEHOLD_SAVED_TOAST });
            }
          }
          return;
        }
        if (result.conflict) {
          if (result.conflictState && result.conflictUpdatedAt) {
            applyRemoteState(result.conflictState, result.conflictUpdatedAt, {
              toast: true,
              toastMessage: 'Your partner saved newer changes — workbook updated.',
            });
          } else {
            setSyncConflict(true);
            pushToast({
              type: 'error',
              message:
                'Could not save — another device saved first. Tap Reload from server in the banner or Tools.',
            });
            void checkRemoteAndMaybeApply();
          }
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
        } else {
          void checkRemoteAndMaybeApply();
        }
      }
    },
    [markServerSynced, applyRemoteState, checkRemoteAndMaybeApply],
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
    setState((s) => {
      if (JSON.stringify(s.income) === JSON.stringify(income)) return s;
      return { ...s, income };
    });
  }, []);

  const setEssentials = useCallback((essentials: EssentialExpense[]) => {
    setState((s) => {
      if (JSON.stringify(s.essentials) === JSON.stringify(essentials)) return s;
      return { ...s, essentials };
    });
  }, []);

  const setDebts = useCallback((debts: DebtAccount[]) => {
    setState((s) => {
      if (JSON.stringify(s.debts) === JSON.stringify(debts)) return s;
      const next = { ...s, debts };
      stateRef.current = next;
      void writeWidgetCache(next);
      return next;
    });
  }, []);

  const updateDebtBalance = useCallback((debtId: string, availableCredit: number, creditLimit?: number) => {
    const before = stateRef.current;
    const beforeMonths = estimatedDebtFreeMonths(before);
    const today = new Date().toISOString().slice(0, 10);
    const target = before.debts.find((d) => d.id === debtId);
    if (!target || target.kind !== 'card') return;

    const patched = applyCardAvailableCheckIn(target, availableCredit, creditLimit);
    if (!patched) {
      pushToast({ type: 'error', message: 'Set a credit limit for this card first.' });
      return;
    }

    setState((s) => {
      const debts = s.debts.map((d) =>
        d.id === debtId ? { ...patched, balanceUpdatedAt: today } : d,
      );
      const next = { ...s, debts };
      stateRef.current = next;
      void writeWidgetCache(next);
      return next;
    });

    const afterDebts = before.debts.map((d) =>
      d.id === debtId ? { ...patched, balanceUpdatedAt: today } : d,
    );
    const afterMonths = estimatedDebtFreeMonths({ ...before, debts: afterDebts });
    const name = target.name;
    if (beforeMonths !== null && afterMonths !== null && beforeMonths !== afterMonths) {
      pushToast({
        type: 'success',
        message: `${name} updated · est. debt-free ${beforeMonths} → ${afterMonths} mo`,
      });
    } else {
      pushToast({
        type: 'success',
        message: `${name}: ${formatMoney(availableCredit)} available → ${formatMoney(patched.balance)} owed`,
      });
    }
  }, []);

  const updateDebtBalanceDirect = useCallback(
    (debtId: string, balance: number, options?: { markPaidOff?: boolean }) => {
      const before = stateRef.current;
      const beforeMonths = estimatedDebtFreeMonths(before);
      const today = new Date().toISOString().slice(0, 10);
      const target = before.debts.find((d) => d.id === debtId);
      if (!target || target.kind === 'card') return;

      const safeBal = round2(balance);
      const markPaidOff = Boolean(options?.markPaidOff || safeBal === 0);

      setState((s) => {
        let next: FinanceState = {
          ...s,
          debts: s.debts.map((d) =>
            d.id === debtId ? { ...d, balance: safeBal, balanceUpdatedAt: today } : d,
          ),
        };
        if (markPaidOff) next = applyMarkAllUnpaidDebtOccurrences(next, debtId);
        stateRef.current = next;
        void writeWidgetCache(next);
        return next;
      });

      const afterDebts = before.debts.map((d) =>
        d.id === debtId ? { ...d, balance: safeBal, balanceUpdatedAt: today } : d,
      );
      let afterState: FinanceState = { ...before, debts: afterDebts };
      if (markPaidOff) afterState = applyMarkAllUnpaidDebtOccurrences(afterState, debtId);
      const afterMonths = estimatedDebtFreeMonths(afterState);
      const name = target.name;

      if (markPaidOff) {
        pushToast({ type: 'success', message: `${name} marked paid off.` });
      } else if (beforeMonths !== null && afterMonths !== null && beforeMonths !== afterMonths) {
        pushToast({
          type: 'success',
          message: `${name} updated · est. debt-free ${beforeMonths} → ${afterMonths} mo`,
        });
      } else {
        pushToast({ type: 'success', message: `${name}: ${formatMoney(safeBal)} remaining` });
      }
    },
    [],
  );

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
    saveThemePreference(theme);
    setState((s) => {
      const next = { ...s, theme };
      stateRef.current = next;
      return next;
    });
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
      let paidDelta = 0;
      const debtRow = s.debts.find((d) => d.id === billId);
      if (debtRow && row.category === 'debt') {
        if (wasPaid) {
          paidDelta = -(inner[payKey] ?? debtRow.monthlyPayment);
        } else {
          const amt =
            typeof actualPaid === 'number' && Number.isFinite(actualPaid) && actualPaid >= 0
              ? actualPaid
              : debtRow.monthlyPayment;
          paidDelta = amt;
        }
      }
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

      const debts =
        paidDelta !== 0 && debtRow
          ? s.debts.map((d) =>
              d.id === billId
                ? { ...d, balance: round2((Number(d.balance) || 0) - paidDelta) }
                : d,
            )
          : s.debts;

      let next: FinanceState = {
        ...s,
        debts,
        billsPaid: { ...s.billsPaid, [billId]: [...cur] },
        billsAutoUnmarked,
        billPaidAmounts,
        billPaymentAttribution,
      };

      if (!wasPaid && debtRow && row.category === 'debt') {
        next = applySmartDebtPaymentFinalize(next, billId);
      }

      stateRef.current = next;
      void writeWidgetCache(next);
      return next;
    });
    if (serverSaveRef.current !== null) {
      clearTimeout(serverSaveRef.current);
      serverSaveRef.current = null;
    }
    void flushServerSave({ notify: true });
  }, [flushServerSave]);

  /** Tag an already-paid bill occurrence to Primary (owner) or Partner on the income vs spend chart. */
  const assignBillPayment = useCallback(
    (billId: string, payKey: string, role: 'owner' | 'partner') => {
      if (!billId || !payKey) return;
      setState((s) => {
        const billPaymentAttribution = { ...(s.billPaymentAttribution ?? {}) };
        const attrInner = { ...(billPaymentAttribution[billId] ?? {}) };
        const sess = readHouseholdSession();
        const entry: BillPaymentAttribution = {
          role,
          memberEmail: sess?.email,
          platform: getClientPlatform(),
          at: new Date().toISOString(),
        };
        attrInner[payKey] = entry;
        billPaymentAttribution[billId] = attrInner;
        const next = { ...s, billPaymentAttribution };
        stateRef.current = next;
        void writeWidgetCache(next);
        return next;
      });
      if (serverSaveRef.current !== null) {
        clearTimeout(serverSaveRef.current);
        serverSaveRef.current = null;
      }
      void flushServerSave({ notify: true });
    },
    [flushServerSave],
  );

  const markNextDebtPayment = useCallback(
    (debtId: string) => {
      const s = stateRef.current;
      const d = s.debts.find((x) => x.id === debtId);
      if (!d || d.kind === 'card' || d.monthlyPayment <= 0) return;

      const next = nextUnpaidDebtOccurrence(s, debtId);
      if (!next) {
        pushToast({
          type: 'success',
          message: `${d.name}: calendar is up to date — use Update if the balance still looks wrong.`,
        });
        return;
      }

      const payKey = billPaymentKey(s, { billId: debtId, due: next.due, category: 'debt' });
      const wasPaid = (s.billsPaid[debtId] ?? []).includes(payKey);
      const unpaidBefore = debtPaymentOccurrences(s, d).filter((b) => !billOccurrenceIsPaid(s, b)).length;
      const isLastInstallment = unpaidBefore === 1;

      toggleBillPaid({
        billId: debtId,
        due: next.due,
        category: 'debt',
        label: d.name,
        actualPaid: next.amount,
      });

      if (!wasPaid) {
        if (isLastInstallment) {
          pushToast({ type: 'success', message: `${d.name} paid off — moved to achievements.` });
        } else {
          const mk = payKey.length === 7 ? payKey : next.due.toISOString().slice(0, 10);
          pushToast({
            type: 'success',
            message: `${d.name}: ${formatMoney(next.amount)} marked paid (${mk})`,
          });
        }
      }
    },
    [toggleBillPaid],
  );

  const addExtraIncome = useCallback((entry: ExtraIncomeEntry) => {
    setState((s) => {
      const next = { ...s, extraIncome: [entry, ...s.extraIncome] };
      void writeWidgetCache(next);
      return next;
    });
    const label = entry.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Added extra income “${label}”.` : 'Added extra income.',
    });
  }, []);

  const removeExtraIncome = useCallback((id: string) => {
    const entry = stateRef.current.extraIncome.find((e) => e.id === id);
    setState((s) => {
      const next = { ...s, extraIncome: s.extraIncome.filter((e) => e.id !== id) };
      void writeWidgetCache(next);
      return next;
    });
    const label = entry?.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Removed extra income “${label}”.` : 'Removed extra income.',
    });
  }, []);

  const addSurpriseExpense = useCallback((entry: SurpriseExpenseEntry) => {
    setState((s) => {
      const next = { ...s, surpriseExpenses: [entry, ...s.surpriseExpenses] };
      void writeWidgetCache(next);
      return next;
    });
    const label = entry.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Added surprise expense “${label}”.` : 'Added surprise expense.',
    });
  }, []);

  const removeSurpriseExpense = useCallback((id: string) => {
    const entry = stateRef.current.surpriseExpenses.find((e) => e.id === id);
    setState((s) => {
      const next = {
        ...s,
        surpriseExpenses: s.surpriseExpenses.filter((e) => e.id !== id),
      };
      void writeWidgetCache(next);
      return next;
    });
    const label = entry?.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Removed surprise expense “${label}”.` : 'Removed surprise expense.',
    });
  }, []);

  const addIncomeLog = useCallback((entry: IncomeLogEntry) => {
    setState((s) => {
      const next = { ...s, incomeLog: [entry, ...s.incomeLog] };
      void writeWidgetCache(next);
      return next;
    });
    const label = entry.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Logged paycheque “${label}”.` : 'Logged paycheque.',
    });
  }, []);

  const removeIncomeLog = useCallback((id: string) => {
    const entry = stateRef.current.incomeLog.find((e) => e.id === id);
    setState((s) => {
      const next = { ...s, incomeLog: s.incomeLog.filter((e) => e.id !== id) };
      void writeWidgetCache(next);
      return next;
    });
    const label = entry?.label?.trim();
    pushToast({
      type: 'success',
      message: label ? `Removed paycheque “${label}”.` : 'Removed paycheque.',
    });
  }, []);

  const updateIncomeLog = useCallback((id: string, patch: Partial<IncomeLogEntry>) => {
    setState((s) => {
      const next = {
        ...s,
        incomeLog: s.incomeLog.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
      void writeWidgetCache(next);
      return next;
    });
  }, []);

  const updateExtraIncome = useCallback((id: string, patch: Partial<ExtraIncomeEntry>) => {
    setState((s) => {
      const next = {
        ...s,
        extraIncome: s.extraIncome.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
      void writeWidgetCache(next);
      return next;
    });
  }, []);

  const updateSurpriseExpense = useCallback((id: string, patch: Partial<SurpriseExpenseEntry>) => {
    setState((s) => {
      const next = {
        ...s,
        surpriseExpenses: s.surpriseExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
      void writeWidgetCache(next);
      return next;
    });
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
   * Confirm month opening: apply optional emergency/goal allocations from prior-month slack; roll remainder into carry-in.
   */
  const completeMonthCashflowOpening = useCallback((allocations: MonthOpeningAllocationInput) => {
    setState((s) => {
      const mk = currentMonthKey();
      const prev = previousCalendarMonthKey(mk);
      const slack = monthPocketSlackForRollover(s, prev);
      let directed = totalMonthOpeningAllocation(allocations);
      directed = Math.max(0, Math.min(directed, slack));

      let emergencyAdd = Math.max(0, Number(allocations.emergency) || 0);
      if (!Number.isFinite(emergencyAdd)) emergencyAdd = 0;
      emergencyAdd = Math.min(emergencyAdd, directed);

      let remaining = round2(directed - emergencyAdd);
      const goalAdds: Record<string, number> = {};
      for (const g of s.savingsGoals ?? []) {
        const want = Math.max(0, Number(allocations.goals?.[g.id]) || 0);
        const take = Math.min(want, remaining);
        if (take > 0) goalAdds[g.id] = take;
        remaining = round2(remaining - take);
      }

      const carry = allocations.skipCarry ? 0 : round2(Math.max(0, slack - directed));
      const today = new Date().toISOString().slice(0, 10);
      const carryMap = { ...(s.monthSpendableCarryByMonth ?? {}) };
      if (carry <= 0) delete carryMap[mk];
      else carryMap[mk] = carry;

      const cardAvailable = allocations.cardAvailableCredit ?? {};
      const nextDebts = s.debts.map((d) => {
        if (d.kind !== 'card') return d;
        const avail = cardAvailable[d.id];
        if (avail === undefined) return d;
        const patched = applyCardAvailableCheckIn(d, avail);
        if (!patched) return d;
        return { ...patched, balanceUpdatedAt: today };
      });

      const nextState = { ...s, debts: nextDebts };
      const sim = simulateDebtPayoff(nextDebts, new Date(), { state: nextState });
      const debtFreeProjectionByMonth = {
        ...(s.debtFreeProjectionByMonth ?? {}),
        [mk]: { months: sim.months, totalDebt: round2(totalDebtRemaining(nextDebts, new Date(), nextState)) },
      };

      const nextGoals = (s.savingsGoals ?? []).map((g) => {
        const add = goalAdds[g.id] ?? 0;
        return add > 0 ? { ...g, balance: round2((Number(g.balance) || 0) + add) } : g;
      });

      const allocRecord: MonthOpeningAllocationInput = {
        emergency: emergencyAdd > 0 ? emergencyAdd : undefined,
        goals: Object.keys(goalAdds).length > 0 ? goalAdds : undefined,
      };

      return {
        ...s,
        debts: nextDebts,
        emergencyFund: round2(s.emergencyFund + emergencyAdd),
        savingsGoals: nextGoals,
        monthSpendableCarryByMonth: carryMap,
        debtFreeProjectionByMonth,
        monthCashflowOpening: {
          ...(s.monthCashflowOpening ?? {}),
          [mk]: {
            confirmedAt: today,
            forMonthKey: mk,
            settledFromPriorMonthKey: prev,
            priorSurplusRemainderShown: round2(slack),
            savingsDirectedAway: directed,
            carryApplied: carry,
            allocations: allocRecord,
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
      const sess = readHouseholdSession();
      const role = sess?.role === 'partner' ? 'partner' : 'owner';
      return {
        ...s,
        emergencyFund: s.emergencyFund + amt,
        budgetSurplusSweeps: [
          ...(s.budgetSurplusSweeps ?? []),
          { id, monthKey: mk, amount: amt, date: today, paidByRole: role },
        ],
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    const blank = defaultFinanceState();
    setState(blank);
    stateRef.current = blank;
    setSyncConflict(false);
    // The debounced state-change save would push a non-forced (conflict-prone) copy; skip it
    // and push the blank workbook authoritatively so the server can't re-sync the old data back.
    skipNextServerSaveRef.current = true;
    if (serverSaveRef.current !== null) {
      clearTimeout(serverSaveRef.current);
      serverSaveRef.current = null;
    }
    void flushServerSave({ force: true, notify: false });
  }, [flushServerSave]);

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
    updateDebtBalance,
    updateDebtBalanceDirect,
    markNextDebtPayment,
    setAllocation,
    setWallets,
    setEmergency,
    setThreeMonthTarget,
    setTheme,
    toggleBillPaid,
    assignBillPayment,
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
