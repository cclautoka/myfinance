import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultFinanceState } from '../data/defaults';
import {
  fetchServerFinanceState,
  getServerStorageConfig,
  loadFinanceState,
  putServerFinanceState,
  saveFinanceState,
} from '../data/storage';
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
  buildFinanceChangeSummary,
  buildSnapshotForReminders,
  pocketLeftSoFar,
  postNotifyRelay,
  postSnapshotRelay,
} from '../utils/notifyRelay';
import { readNotifyRelayConfig } from '../utils/notifyRelayConfig';

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

export function usePersistedFinance() {
  const [state, setState] = useState<FinanceState>(() => loadFinanceState());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveFinanceState(state);
  }, [state]);

  /** Server hydration + one-time import when server is empty. */
  useEffect(() => {
    const cfg = getServerStorageConfig();
    if (!cfg.enabled) return;

    let cancelled = false;
    (async () => {
      const remote = await fetchServerFinanceState();
      if (cancelled) return;

      if (!remote.ok && remote.status === 404) {
        // Server empty; one-time import of current local/cache state.
        await putServerFinanceState(stateRef.current);
        const after = await fetchServerFinanceState();
        if (!cancelled && after.ok) setState(after.state);
        return;
      }

      if (remote.ok) {
        setState(remote.state);
      }
    })().catch(() => {
      /* offline / ignore */
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const reloadFromServer = useCallback(async () => {
    const cfg = getServerStorageConfig({ force: true });
    if (!cfg.enabled) return { ok: false as const, error: 'Server storage not configured yet (URL + secret + household id).' };
    const remote = await fetchServerFinanceState({ force: true });
    if (!remote.ok) {
      if (remote.status === 404) {
        return { ok: false as const, error: 'No server data found for this household id yet.' };
      }
      return { ok: false as const, error: remote.error || 'Failed to load server data.' };
    }
    setState(remote.state);
    return { ok: true as const, updatedAt: remote.updatedAt };
  }, []);

  /** Server persistence (debounced) — local cache is written in saveFinanceState above. */
  const serverSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const cfg = getServerStorageConfig();
    if (!cfg.enabled) return;
    if (serverSaveRef.current !== null) clearTimeout(serverSaveRef.current);
    serverSaveRef.current = setTimeout(() => {
      serverSaveRef.current = null;
      void putServerFinanceState(stateRef.current);
    }, 1500);
    return () => {
      if (serverSaveRef.current !== null) clearTimeout(serverSaveRef.current);
    };
  }, [state]);

  /** Re-check wife biweekly auto-log when the tab regains focus so a Thursday-afternoon hit appears without full reload. */
  useEffect(() => {
    const run = () =>
      setState((s) => {
        const next = applyAutoScheduledPayLogs(s, new Date());
        return next.incomeLog === s.incomeLog ? s : next;
      });
    run();
    const onFocus = () => run();
    const onVis = () => document.visibilityState === 'visible' && run();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

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
    setState((s) => {
      const payKey = billPaymentKey(s, row);
      const { billId, actualPaid } = row;
      const cur = new Set(s.billsPaid[billId] ?? []);
      const wasPaid = cur.has(payKey);
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

      return {
        ...s,
        billsPaid: { ...s.billsPaid, [billId]: [...cur] },
        billsAutoUnmarked,
        billPaidAmounts,
      };
    });
  }, []);

  const addExtraIncome = useCallback((entry: ExtraIncomeEntry) => {
    setState((s) => ({ ...s, extraIncome: [entry, ...s.extraIncome] }));
  }, []);

  const removeExtraIncome = useCallback((id: string) => {
    setState((s) => ({ ...s, extraIncome: s.extraIncome.filter((e) => e.id !== id) }));
  }, []);

  const addSurpriseExpense = useCallback((entry: SurpriseExpenseEntry) => {
    setState((s) => ({ ...s, surpriseExpenses: [entry, ...s.surpriseExpenses] }));
  }, []);

  const removeSurpriseExpense = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      surpriseExpenses: s.surpriseExpenses.filter((e) => e.id !== id),
    }));
  }, []);

  const addIncomeLog = useCallback((entry: IncomeLogEntry) => {
    setState((s) => ({ ...s, incomeLog: [entry, ...s.incomeLog] }));
  }, []);

  const removeIncomeLog = useCallback((id: string) => {
    setState((s) => ({ ...s, incomeLog: s.incomeLog.filter((e) => e.id !== id) }));
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
  useEffect(() => {
    const h = hashFinanceState(state);
    if (notifyBaselineRef.current === null) {
      notifyBaselineRef.current = h;
      return;
    }
    if (notifyBaselineRef.current === h) return;
    notifyBaselineRef.current = h; // new snapshot — arm debounced notify

    if (notifyDebounceRef.current !== null) clearTimeout(notifyDebounceRef.current);
    notifyDebounceRef.current = setTimeout(() => {
      notifyDebounceRef.current = null;
      const cfg = readNotifyRelayConfig();
      if (!cfg.enabled || !cfg.url || !cfg.secret) return;
      const latest = stateRef.current;
      const summary = buildFinanceChangeSummary(latest);
      const mk = currentMonthKey();
      const pocket = pocketLeftSoFar(latest);
      void postNotifyRelay(summary, { monthKey: mk, pocketLeft: pocket }).then((r) => {
        if (!r.ok && typeof console !== 'undefined') {
          console.warn('[notify relay]', r.error);
        }
      });
      void postSnapshotRelay(buildSnapshotForReminders(latest)).then((r) => {
        if (!r.ok && typeof console !== 'undefined') console.warn('[notify relay snapshot]', r.error);
      });
    }, 60_000);

    return () => {
      if (notifyDebounceRef.current !== null) clearTimeout(notifyDebounceRef.current);
    };
  }, [state]);

  return {
    state,
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
    reloadFromServer,
  };
}
