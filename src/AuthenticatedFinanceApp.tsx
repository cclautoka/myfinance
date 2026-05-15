import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { TimelineColumnSpotlight } from './components/TimelineColumnSpotlight';
import { AllocationPanel } from './components/AllocationPanel';
import { BudgetSurplusPanel } from './components/BudgetSurplusPanel';
import { BillsTimeline } from './components/BillsTimeline';
import { DashboardIncomeBridge } from './components/DashboardIncomeBridge';
import { DashboardOverview } from './components/DashboardOverview';
import { DataEditor } from './components/DataEditor';
import { DebtBalancesPanel } from './components/DebtBalancesPanel';
import { DebtSnowball } from './components/DebtSnowball';
import { EmergencyFund } from './components/EmergencyFund';
import { Header } from './components/Header';
import { IncomeLogPanel } from './components/IncomeLogPanel';
import { LifeThisMonth } from './components/LifeThisMonth';
import { HistoryMonthBanner } from './components/HistoryMonthBanner';
import { AppPrimaryTabs, type AppTab } from './components/layout/AppPrimaryTabs';
import { FinanceToolsPanel } from './components/layout/FinanceToolsPanel';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { FinanceWorkspaceShell, type WorkspaceTabSelection } from './components/layout/FinanceWorkspaceShell';
import { PageSection } from './components/layout/PageSection';
import { MonthCashflowOpeningModal } from './components/MonthCashflowOpeningModal';
import { MonthFocusBar } from './components/MonthFocusBar';
import { SpotlightTour } from './components/onboarding/SpotlightTour';
import { MonthlyReport } from './components/MonthlyReport';
import { PaymentsLifetimePanel } from './components/PaymentsLifetimePanel';
import { PastMonthInsights } from './components/PastMonthInsights';
import { SurpriseExpenses } from './components/SurpriseExpenses';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { UpcomingBillsStrip } from './components/UpcomingBillsStrip';
import { WalletPanel } from './components/WalletPanel';
import { ONBOARDING_STORAGE_KEY, ONBOARDING_STEPS, ONBOARDING_TOUR_LATER_KEY } from './onboarding/constants';
import {
  HISTORY_EARLIEST_MONTH_KEY,
  currentMonthKey,
  historySelectableMonthKeys,
} from './data/defaults';
import { usePersistedFinance } from './hooks/usePersistedFinance';
import { VerifyEmailGate } from './auth/VerifyEmailGate';
import { HouseholdSetupWizard } from './setup/HouseholdSetupWizard';
import {
  isHouseholdSetupComplete,
  readHouseholdSetupCompletion,
  syncHouseholdSetupFromServerState,
} from './setup/setupCompletion';
import { zLayers } from './ui/zLayers';
import { requiresMonthCashflowOpening } from './utils/monthOpening';
import {
  clearHouseholdSession,
  readHouseholdSession,
  subscribeHouseholdSessionChanged,
  writeHouseholdSession,
} from './utils/householdSession';
import {
  apiBaseFromNotifyUrl,
  parseVerifyTokenFromHash,
  postNotifyRelayPublicJson,
  readNotifyRelayConfig,
} from './utils/notifyRelayConfig';

function applyThemeClass(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const setDark = (on: boolean) => {
    if (on) root.classList.add('dark');
    else root.classList.remove('dark');
  };
  if (theme === 'dark') setDark(true);
  else if (theme === 'light') setDark(false);
  else setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
}

const DASHBOARD_BILLS_COLUMN_ID = 'dashboard-bills-column';

export function AuthenticatedFinanceApp() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [tourReplay, setTourReplay] = useState(0);
  const [tourLaterToast, setTourLaterToast] = useState(false);
  const [magicLinkBanner, setMagicLinkBanner] = useState<string | null>(null);
  /** Full timeline click: dims the rest of the page and frames the checklist column briefly. */
  const [timelineColumnSpotlight, setTimelineColumnSpotlight] = useState(false);
  const [appTab, setAppTab] = useState<AppTab>('dashboard');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabSelection>(null);
  const [focusedMonthKey, setFocusedMonthKey] = useState(() => {
    const keys = historySelectableMonthKeys();
    return keys[0] ?? HISTORY_EARLIEST_MONTH_KEY;
  });

  const scrollToBills = () => {
    setAppTab('dashboard');
    setTimelineColumnSpotlight(true);
    requestAnimationFrame(() => {
      document.getElementById('bills-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const {
    state,
    update,
    setTheme,
    setWallets,
    setEmergency,
    setThreeMonthTarget,
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
    setIncome,
    setEssentials,
    setDebts,
    resetAll,
    reloadFromServer,
  } = usePersistedFinance();

  const monthOpeningBlocked = requiresMonthCashflowOpening(state);

  const householdSignedIn = useSyncExternalStore(
    subscribeHouseholdSessionChanged,
    () => Boolean(readHouseholdSession()?.token),
    () => false,
  );

  const [setupTick, setSetupTick] = useState(0);
  const notifyCfgForVerify = readNotifyRelayConfig();
  const apiConfiguredForVerify = Boolean(apiBaseFromNotifyUrl(notifyCfgForVerify.url));
  const [emailVerified, setEmailVerified] = useState(() => {
    const sess = readHouseholdSession();
    if (sess?.emailVerified === true) return true;
    if (sess?.emailVerified === false) return false;
    return !apiConfiguredForVerify;
  });

  useEffect(() => {
    const cfg = readNotifyRelayConfig();
    const hadCompletion = Boolean(readHouseholdSetupCompletion());
    if (syncHouseholdSetupFromServerState(state, cfg) && !hadCompletion) {
      setSetupTick((n) => n + 1);
    }
  }, [state]);

  useEffect(() => {
    const vt = parseVerifyTokenFromHash();
    if (!vt) return;
    let cancelled = false;
    void (async () => {
      try {
        const j = (await postNotifyRelayPublicJson('/v1/household/auth/verify-email', { token: vt })) as {
          token?: string;
          member?: { email?: string; role?: string; householdId?: string };
        };
        if (cancelled) return;
        if (j.token && j.member?.householdId) {
          writeHouseholdSession({
            token: j.token,
            householdId: j.member.householdId,
            email: j.member.email,
            role: j.member.role,
          });
        }
        setEmailVerified(true);
        setMagicLinkBanner('Email verified — you can continue in the app.');
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!cancelled) setMagicLinkBanner(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!householdSignedIn) {
      setEmailVerified(true);
      return;
    }
    const base = apiBaseFromNotifyUrl(readNotifyRelayConfig().url);
    if (!base) {
      setEmailVerified(true);
      return;
    }
    const sess = readHouseholdSession();
    if (!sess?.token) {
      setEmailVerified(false);
      return;
    }
    let cancelled = false;
    void fetch(`${base}/v1/household/auth/me`, {
      headers: { Authorization: `Bearer ${sess.token}` },
    })
      .then(async (res) => {
        if (res.status === 401) return 'unauthorized' as const;
        if (res.status === 403) {
          try {
            const j = (await res.json()) as { code?: string; member?: { emailVerified?: boolean } };
            if (j.code === 'EMAIL_NOT_VERIFIED') return 'unverified' as const;
          } catch {
            /* ignore */
          }
          return 'unverified' as const;
        }
        if (!res.ok) return 'unknown' as const;
        const j = (await res.json()) as { member?: { emailVerified?: boolean } };
        return j.member?.emailVerified ? ('verified' as const) : ('unverified' as const);
      })
      .then((status) => {
        if (cancelled || !status) return;
        if (status === 'unauthorized') {
          clearHouseholdSession();
          return;
        }
        if (status === 'unverified') {
          setEmailVerified(false);
          writeHouseholdSession({ ...sess, emailVerified: false });
          return;
        }
        setEmailVerified(true);
        writeHouseholdSession({ ...sess, emailVerified: true });
      })
      .catch(() => {
        if (!cancelled && sess.emailVerified !== false) {
          setEmailVerified(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [householdSignedIn]);

  useEffect(() => {
    const refresh = () => {
      const sess = readHouseholdSession();
      if (!sess?.token) return;
      const base = apiBaseFromNotifyUrl(readNotifyRelayConfig().url);
      if (!base) return;
      void fetch(`${base}/v1/household/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sess.token}` },
      })
        .then(async (r) => {
          if (!r.ok) return null;
          return r.json() as Promise<{ token?: string }>;
        })
        .then((j) => {
          if (j?.token) writeHouseholdSession({ ...sess, token: j.token });
        })
        .catch(() => {});
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const notifyCfg = readNotifyRelayConfig();
  const setupDone = useMemo(
    () => isHouseholdSetupComplete(state, readNotifyRelayConfig()),
    // setupTick: wizard completion writes localStorage; force re-check without a full state bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    [state, setupTick],
  );
  const needsVerifyGate = Boolean(apiBaseFromNotifyUrl(notifyCfg.url)) && !emailVerified;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ONBOARDING_TOUR_LATER_KEY) !== '1') return;
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1') {
        sessionStorage.removeItem(ONBOARDING_TOUR_LATER_KEY);
        return;
      }
      setTourLaterToast(true);
    } catch {
      /* ignore */
    }
  }, []);

  const selectableHistoryKeys = historySelectableMonthKeys();
  const focusedHistoryMonth =
    selectableHistoryKeys.length > 0 && !selectableHistoryKeys.includes(focusedMonthKey)
      ? selectableHistoryKeys[0]
      : focusedMonthKey;

  useEffect(() => {
    applyThemeClass(state.theme);
    if (state.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeClass('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [state.theme]);

  /** Status bar tint on mobile (matches light/dark body). */
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!(meta instanceof HTMLMetaElement)) return;
    const light = '#f4f7fb';
    const dark = '#050506';
    const sync = () => {
      meta.content = document.documentElement.classList.contains('dark') ? dark : light;
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const openTourReplay = () => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      sessionStorage.removeItem(ONBOARDING_TOUR_LATER_KEY);
    } catch {
      /* ignore */
    }
    setTourLaterToast(false);
    setTourReplay((n) => n + 1);
  };

  useEffect(() => {
    void reloadFromServer().catch(() => {});
  }, [reloadFromServer]);

  if (needsVerifyGate) {
    return (
      <VerifyEmailGate
        theme={state.theme}
        onTheme={setTheme}
        email={readHouseholdSession()?.email}
      />
    );
  }

  if (!setupDone) {
    return (
      <HouseholdSetupWizard
        state={state}
        setIncome={setIncome}
        setEssentials={setEssentials}
        setDebts={setDebts}
        onComplete={() => setSetupTick((n) => n + 1)}
        theme={state.theme}
        onTheme={setTheme}
      />
    );
  }

  return (
    <div className="min-h-svh pb-[max(4rem,calc(4.5rem+env(safe-area-inset-bottom,0px)))] lg:pb-16">
      {!monthOpeningBlocked ? (
        <TimelineColumnSpotlight
          open={timelineColumnSpotlight}
          targetId={DASHBOARD_BILLS_COLUMN_ID}
          onClose={() => setTimelineColumnSpotlight(false)}
        />
      ) : null}
      {!monthOpeningBlocked ? (
        <SpotlightTour
          key={tourReplay}
          householdSignedIn={householdSignedIn}
          layoutSyncKey={`${appTab}-${workspaceTab ?? 'none'}`}
          onPrepareStep={(i) => {
            const t = ONBOARDING_STEPS[i]?.target;
            if (t === 'tour-dashboard-snapshot' || t === 'tour-bills-checklist') {
              setAppTab('dashboard');
            }
            if (t === 'tour-pay-log') {
              setAppTab('dashboard');
              const more = document.getElementById('dashboard-more-month');
              if (more instanceof HTMLDetailsElement) more.open = true;
            }
            if (t === 'tour-workspace') {
              setAppTab('workspace');
            }
            if (t === 'tour-tools-notify') {
              setAppTab('tools');
            }
          }}
        />
      ) : null}
      <div
        {...(monthOpeningBlocked ? { inert: true as const } : {})}
        className={
          monthOpeningBlocked
            ? 'pointer-events-none select-none opacity-[0.35] saturate-75'
            : undefined
        }
        aria-hidden={monthOpeningBlocked}
      >
      <Header
        theme={state.theme}
        onTheme={setTheme}
        householdSignedIn={householdSignedIn}
      />
      <AppPrimaryTabs value={appTab} onChange={setAppTab} />
      {!monthOpeningBlocked ? <MobileBottomNav appTab={appTab} onAppTabChange={setAppTab} /> : null}
      <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-10 xl:max-w-[96rem]">
        {appTab === 'dashboard' ? (
          <div role="tabpanel" id="app-tabpanel-dashboard" aria-labelledby="app-tab-dashboard" className="space-y-12">
            <PageSection
              id="finance-dashboard"
              dataTour="tour-dashboard"
              title="Dashboard"
              subtitle="This month: snapshot in the centre · bills on the sides · pay log below."
              variant="band"
              accent="emerald"
              eyebrow="Live month"
            >
              <div className="relative isolate flex min-w-0 flex-col gap-10 lg:block">
                <div className="order-3 flex min-w-0 flex-col gap-8 lg:order-none lg:ml-[calc((100%-4rem)*3/12+2rem)] lg:mr-[calc((100%-4rem)*3/12+2rem)] lg:w-[calc((100%-4rem)*6/12)]">
                  <div data-tour="tour-dashboard-snapshot" className="min-w-0 space-y-8">
                    <DashboardOverview state={state} />
                    <PaymentsLifetimePanel state={state} />
                  </div>
                  <details
                    id="dashboard-more-month"
                    className="group rounded-xl border border-slate-200/80 bg-white/80 open:bg-white dark:border-moss-border dark:bg-moss-surface/60 dark:open:bg-moss-surface"
                  >
                    <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-bold text-slate-800 marker:content-none dark:text-moss-fg [&::-webkit-details-marker]:hidden">
                      <span className="underline decoration-slate-400 decoration-2 underline-offset-2 group-open:no-underline">
                        More this month (snowball, surplus, pay)
                      </span>
                    </summary>
                    <div className="space-y-8 border-t border-slate-200/70 px-3 pb-4 pt-4 dark:border-moss-border">
                      <DebtSnowball state={state} compact />
                      <BudgetSurplusPanel
                        state={state}
                        onSweepToEmergency={applyBudgetSurplusToEmergency}
                        onSetMonthSpendableCarry={setMonthSpendableCarry}
                      />
                      <div data-tour="tour-pay-log" className="space-y-4">
                        <DashboardIncomeBridge state={state} />
                        <IncomeLogPanel
                          variant="dashboard"
                          state={state}
                          monthKey={currentMonthKey()}
                          onAdd={addIncomeLog}
                          onRemove={removeIncomeLog}
                          onUpdateIncomeLog={updateIncomeLog}
                        />
                      </div>
                    </div>
                  </details>
                  <LifeThisMonth state={state} onAddExtra={addExtraIncome} onRemoveExtra={removeExtraIncome} />
                </div>

                <aside className="order-1 min-w-0 lg:order-none lg:absolute lg:left-0 lg:top-0 lg:z-[1] lg:h-full lg:w-[calc((100%-4rem)*3/12)] lg:overflow-hidden">
                  <div className="scrollbar-app h-auto min-h-0 w-full min-w-0">
                    <UpcomingBillsStrip state={state} onOpenTimeline={scrollToBills} />
                  </div>
                </aside>

                <aside
                  id={DASHBOARD_BILLS_COLUMN_ID}
                  className="order-2 min-w-0 lg:order-none lg:absolute lg:right-0 lg:top-0 lg:z-[1] lg:h-full lg:w-[calc((100%-4rem)*3/12)] lg:overflow-hidden"
                >
                  <div className="scrollbar-app h-auto min-h-0 w-full min-w-0">
                    <BillsTimeline state={state} onTogglePaid={toggleBillPaid} />
                  </div>
                </aside>
              </div>
            </PageSection>

            <details
              id="finance-surprise-log"
              className="rounded-xl border border-amber-200/70 bg-amber-50/30 px-4 py-2 dark:border-amber-900/35 dark:bg-amber-950/20 sm:px-6"
            >
              <summary className="cursor-pointer py-3 font-display text-lg font-bold text-sage-900 dark:text-moss-fg">
                Unexpected expenses (optional)
              </summary>
              <div className="pb-6 pt-2">
                <SurpriseExpenses state={state} onAdd={addSurpriseExpense} onRemove={removeSurpriseExpense} />
              </div>
            </details>

          </div>
        ) : null}

        {appTab === 'workspace' ? (
          <div role="tabpanel" id="app-tabpanel-workspace" aria-labelledby="app-tab-workspace">
            <FinanceWorkspaceShell
              tab={workspaceTab}
              onTabChange={setWorkspaceTab}
              panels={{
                past: (
                  <div id="finance-history" data-tour="tour-history" className="space-y-10">
                    <MonthFocusBar monthKey={focusedHistoryMonth} onMonthKeyChange={setFocusedMonthKey} />
                    <HistoryMonthBanner state={state} monthKey={focusedHistoryMonth} />
                    <PastMonthInsights
                      state={state}
                      monthKey={focusedHistoryMonth}
                      onRetroMarkHandled={toggleBillPaid}
                      onUpdateExtra={updateExtraIncome}
                      onUpdateSurprise={updateSurpriseExpense}
                      onAddExtra={addExtraIncome}
                      onRemoveExtra={removeExtraIncome}
                      onAddSurprise={addSurpriseExpense}
                      onRemoveSurprise={removeSurpriseExpense}
                    />
                    <IncomeLogPanel
                      variant="pastMonth"
                      state={state}
                      monthKey={focusedHistoryMonth}
                      onAdd={addIncomeLog}
                      onRemove={removeIncomeLog}
                      onUpdateIncomeLog={updateIncomeLog}
                    />
                    <MonthlyReport state={state} summaryMonthKey={focusedHistoryMonth} />
                  </div>
                ),
                household: (
                  <div id="finance-household" data-tour="tour-household" className="space-y-4">
                    <p className="text-sm font-medium text-sage-700 dark:text-moss-subtle">
                      Monthly pay, essentials, and loans — same fields as first-run setup, editable any time.
                    </p>
                    <DataEditor
                      state={state}
                      onIncome={setIncome}
                      onEssentials={setEssentials}
                      onDebts={setDebts}
                      patchState={update}
                    />
                  </div>
                ),
                plan: (
                  <div id="finance-plan" data-tour="tour-plan" className="space-y-10">
                    <AllocationPanel state={state} onPatch={update} />
                    <div>
                      <h3 className="mb-2 font-display text-xl font-bold text-sage-900 dark:text-moss-fg">
                        Fun money & emergency savings
                      </h3>
                      <p className="mb-6 max-w-3xl text-sm font-medium text-sage-700 dark:text-moss-subtle">
                        Discretionary taps per person, and rainy-day balance you refresh after transfers.
                      </p>
                      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                        <WalletPanel state={state} onWallets={setWallets} />
                        <EmergencyFund state={state} onFund={setEmergency} onTarget={setThreeMonthTarget} />
                      </div>
                    </div>
                    <DebtBalancesPanel state={state} />
                    <div className="rounded-xl border border-sage-200/80 bg-sage-50/50 px-4 py-3 text-sm text-sage-700 dark:border-moss-border dark:bg-moss-bg/50 dark:text-moss-subtle">
                      <strong className="text-sage-900 dark:text-moss-fg">Payoff bar chart</strong> lives on the{' '}
                      <button
                        type="button"
                        className="font-semibold text-teal-900 underline underline-offset-2 dark:text-moss-tip"
                        onClick={() => setAppTab('dashboard')}
                      >
                        Dashboard
                      </button>{' '}
                      tab (centre column).
                    </div>
                    <div className="rounded-xl border border-dashed border-sage-400/80 bg-white/90 px-4 py-4 text-sm leading-relaxed text-sage-800 dark:border-moss-border dark:bg-moss-surface/80 dark:text-moss-subtle">
                      <strong className="text-sage-900 dark:text-moss-fg">Bill calendar & checkmarks</strong> stay on the{' '}
                      <button
                        type="button"
                        className="font-semibold text-sage-900 underline underline-offset-2 hover:text-teal-800 dark:text-moss-fg dark:hover:text-teal-300/90"
                        onClick={() => setAppTab('dashboard')}
                      >
                        Dashboard
                      </button>{' '}
                      tab.
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        ) : null}

        {appTab === 'tools' ? (
          <div role="tabpanel" id="app-tabpanel-tools" aria-labelledby="app-tab-tools">
            <FinanceToolsPanel
              state={state}
              onReloadFromServer={reloadFromServer}
              onReplayTour={openTourReplay}
              onRequestReset={() => setResetDialogOpen(true)}
            />
          </div>
        ) : null}

        <ConfirmDialog
          open={resetDialogOpen}
          onClose={() => setResetDialogOpen(false)}
          variant="danger"
          title="Reset to blank worksheet?"
          description="Clears this browser’s budget, paycheck log, debts, and checkmarks back to an empty starter (zeros and no rows). Saved CSV exports on your device are not removed."
          cancelLabel="Keep my data"
          confirmLabel="Reset everything"
          onConfirm={() => resetAll()}
        />
      </main>
      </div>
      {magicLinkBanner ? (
        <div
          className="pointer-events-auto fixed inset-x-0 top-0 flex justify-center px-4 pt-3 sm:pt-4"
          style={{ zIndex: zLayers.toast + 10 }}
        >
          <div className="flex w-full max-w-2xl items-start justify-between gap-3 rounded-xl border border-teal-400/70 bg-teal-50/95 px-4 py-2.5 text-sm text-sage-900 shadow-lg backdrop-blur-sm dark:border-teal-700/50 dark:bg-teal-950/90 dark:text-teal-50">
            <p className="min-w-0 break-words">{magicLinkBanner}</p>
            <button
              type="button"
              className="shrink-0 text-xs font-bold text-teal-800 underline dark:text-teal-200"
              onClick={() => setMagicLinkBanner(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      {monthOpeningBlocked ? (
        <MonthCashflowOpeningModal
          state={state}
          onConfirm={completeMonthCashflowOpening}
          onStartTourAfterUnlock={openTourReplay}
        />
      ) : null}
      {tourLaterToast && !monthOpeningBlocked ? (
        <div
          className="fixed bottom-[max(5.5rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))] left-1/2 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-teal-300/80 bg-white/95 p-3 text-sm shadow-xl backdrop-blur-sm dark:border-teal-800/50 dark:bg-moss-elevated/95 dark:text-moss-fg"
          style={{ zIndex: zLayers.toast }}
        >
          <p className="font-semibold text-sage-900 dark:text-moss-fg">Resume guided tour?</p>
          <p className="mt-1 text-xs text-sage-600 dark:text-moss-muted">You asked to be reminded later.</p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary btn-secondary-sm"
              onClick={() => {
                try {
                  sessionStorage.removeItem(ONBOARDING_TOUR_LATER_KEY);
                } catch {
                  /* ignore */
                }
                setTourLaterToast(false);
              }}
            >
              Dismiss
            </button>
            <button type="button" className="btn-primary btn-primary-sm" onClick={() => openTourReplay()}>
              Continue tour
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
