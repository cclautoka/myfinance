import { useEffect, useState } from 'react';
import { TimelineColumnSpotlight } from './components/TimelineColumnSpotlight';
import { AdvisorPanel } from './components/AdvisorPanel';
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
import { FinanceQuickNav } from './components/layout/FinanceQuickNav';
import { FinanceWorkspaceShell, type WorkspaceTabSelection } from './components/layout/FinanceWorkspaceShell';
import { PageSection } from './components/layout/PageSection';
import { MonthCashflowOpeningModal } from './components/MonthCashflowOpeningModal';
import { MonthFocusBar } from './components/MonthFocusBar';
import { SpotlightTour } from './components/onboarding/SpotlightTour';
import { MonthlyReport } from './components/MonthlyReport';
import { PastMonthInsights } from './components/PastMonthInsights';
import { SurpriseExpenses } from './components/SurpriseExpenses';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { UpcomingBillsStrip } from './components/UpcomingBillsStrip';
import { WalletPanel } from './components/WalletPanel';
import { NotifyRelaySettings } from './components/NotifyRelaySettings';
import { ONBOARDING_STORAGE_KEY } from './onboarding/constants';
import {
  HISTORY_EARLIEST_MONTH_KEY,
  currentMonthKey,
  historySelectableMonthKeys,
} from './data/defaults';
import { usePersistedFinance } from './hooks/usePersistedFinance';
import { requiresMonthCashflowOpening } from './utils/monthOpening';

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

export default function App() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [tourReplay, setTourReplay] = useState(0);
  /** Full timeline click: dims the rest of the page and frames the checklist column briefly. */
  const [timelineColumnSpotlight, setTimelineColumnSpotlight] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabSelection>(null);
  const [focusedMonthKey, setFocusedMonthKey] = useState(() => {
    const keys = historySelectableMonthKeys();
    return keys[0] ?? HISTORY_EARLIEST_MONTH_KEY;
  });

  const scrollToBills = () => {
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

  const openTourReplay = () => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setTourReplay((n) => n + 1);
  };

  return (
    <div className="min-h-svh pb-16">
      {!monthOpeningBlocked ? (
        <TimelineColumnSpotlight
          open={timelineColumnSpotlight}
          targetId={DASHBOARD_BILLS_COLUMN_ID}
          onClose={() => setTimelineColumnSpotlight(false)}
        />
      ) : null}
      {!monthOpeningBlocked ? <SpotlightTour key={tourReplay} /> : null}
      <div
        {...(monthOpeningBlocked ? { inert: true as const } : {})}
        className={
          monthOpeningBlocked
            ? 'pointer-events-none select-none opacity-[0.35] saturate-75'
            : undefined
        }
        aria-hidden={monthOpeningBlocked}
      >
      <Header theme={state.theme} onTheme={setTheme} />
      <FinanceQuickNav dataTour="tour-quick-nav" onWorkspaceTab={setWorkspaceTab} />
      <main className="mx-auto max-w-7xl space-y-24 px-4 py-10 sm:px-6 xl:max-w-[96rem]">
        <PageSection
          id="finance-dashboard"
          dataTour="tour-dashboard"
          title="Dashboard"
          subtitle="Side columns: bills due and checklist. Centre: snapshot, surplus sweeps to emergency, deposits, extras. Surprise bills log in the band right under here — past months live in worksheets tabs."
          variant="band"
          accent="emerald"
          eyebrow="Live month"
        >
          <div className="relative isolate flex min-w-0 flex-col gap-10">
            <div className="flex min-w-0 flex-col gap-8 lg:ml-[calc((100%-4rem)*3/12+2rem)] lg:mr-[calc((100%-4rem)*3/12+2rem)] lg:w-[calc((100%-4rem)*6/12)]">
              <DashboardOverview state={state} />
              <DebtSnowball state={state} compact />
              <BudgetSurplusPanel
                state={state}
                onSweepToEmergency={applyBudgetSurplusToEmergency}
                onSetMonthSpendableCarry={setMonthSpendableCarry}
              />
              <DashboardIncomeBridge state={state} />
              <IncomeLogPanel
                variant="dashboard"
                state={state}
                monthKey={currentMonthKey()}
                onAdd={addIncomeLog}
                onRemove={removeIncomeLog}
                onUpdateIncomeLog={updateIncomeLog}
              />
              <LifeThisMonth state={state} onAddExtra={addExtraIncome} onRemoveExtra={removeExtraIncome} />
            </div>

            <aside className="min-w-0 lg:absolute lg:left-0 lg:top-0 lg:z-[1] lg:h-full lg:w-[calc((100%-4rem)*3/12)] lg:overflow-hidden">
              <div className="scrollbar-app h-auto min-h-0 w-full min-w-0 lg:h-full lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain">
                <UpcomingBillsStrip state={state} onOpenTimeline={scrollToBills} />
              </div>
            </aside>

            <aside
              id={DASHBOARD_BILLS_COLUMN_ID}
              className="min-w-0 lg:absolute lg:right-0 lg:top-0 lg:z-[1] lg:h-full lg:w-[calc((100%-4rem)*3/12)] lg:overflow-hidden"
            >
              <div className="scrollbar-app h-auto min-h-0 w-full min-w-0 lg:h-full lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain">
                <BillsTimeline state={state} onTogglePaid={toggleBillPaid} />
              </div>
            </aside>
          </div>
        </PageSection>

        <PageSection
          id="finance-surprise-log"
          dataTour="tour-surprise-log"
          title="Unexpected expenses"
          subtitle="One-off costs for the story only — typed here soon after they happen so months stay truthful. Uses the same list as Past months recap when you browse older calendar months."
          variant="band"
          accent="amber"
          eyebrow="Story & shocks"
        >
          <SurpriseExpenses state={state} onAdd={addSurpriseExpense} onRemove={removeSurpriseExpense} />
        </PageSection>

        <PageSection
          id="finance-guidance"
          dataTour="tour-guidance"
          title="Money guidance"
          subtitle="Plain-English nudges from what you typed below — patterns and reminders only, not professional advice."
          variant="spotlight"
          accent="teal"
          eyebrow="Read this"
        >
          <AdvisorPanel state={state} prominent />
        </PageSection>

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
                  Monthly pay, rhythms, groceries, utilities, loans — edits flow through the dashboard the same minute you save.
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
                <div className="rounded-2xl border border-sage-200/80 bg-sage-50/50 px-4 py-3 text-sm text-sage-700 dark:border-moss-border dark:bg-moss-bg/50 dark:text-moss-subtle">
                  <strong className="text-sage-900 dark:text-moss-fg">Payoff bar chart</strong> now lives on the{' '}
                  <button
                    type="button"
                    className="font-semibold text-teal-900 underline underline-offset-2 dark:text-moss-tip"
                    onClick={() =>
                      document.getElementById('finance-dashboard')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    Dashboard
                  </button>{' '}
                  (center column).
                </div>
                <div className="rounded-2xl border-2 border-dashed border-sage-400/70 bg-white/85 px-4 py-4 text-sm leading-relaxed text-sage-800 dark:border-moss-border dark:bg-moss-surface/80 dark:text-moss-subtle">
                  <strong className="text-sage-900 dark:text-moss-fg">Bill calendar & checkmarks</strong> stay on the{' '}
                  <button
                    type="button"
                    className="font-semibold text-sage-900 underline underline-offset-2 hover:text-teal-800 dark:text-moss-fg dark:hover:text-teal-300/90"
                    onClick={() =>
                      document.getElementById('finance-dashboard')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    Dashboard
                  </button>
                  .
                </div>
              </div>
            ),
            backup: (
              <div id="finance-manage" data-tour="tour-manage" className="space-y-8">
                <p className="max-w-3xl text-sm font-medium leading-relaxed text-sage-700 dark:text-moss-subtle">
                  Data tools: export from the Past months tab; replay onboarding or wipe this browser workspace below. Auto-scheduled{' '}
                  <strong className="text-sage-900 dark:text-moss-fg">Paycheque</strong> logs for husband and wife are in{' '}
                  <strong className="text-sage-900 dark:text-moss-fg">Household → Your numbers</strong>. Guidance cards live in the Guidance band above.
                </p>
                <NotifyRelaySettings state={state} onReloadFromServer={reloadFromServer} />
                <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-sage-400/80 bg-white/90 p-5 text-sm font-medium leading-relaxed text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-subtle">
                  <p className="max-w-xl">
                    Saved only on this device. Clear site data wipes it — grab a CSV from Past months anytime. Need the walk-through again?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary btn-secondary-sm font-bold" onClick={openTourReplay}>
                      Replay tour
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-secondary-sm font-bold"
                      onClick={() => setResetDialogOpen(true)}
                    >
                      Reset to starter numbers
                    </button>
                  </div>
                </footer>
              </div>
            ),
          }}
        />

        <ConfirmDialog
          open={resetDialogOpen}
          onClose={() => setResetDialogOpen(false)}
          variant="danger"
          title="Reset to starter numbers?"
          description="Everything in this browser—the budget, paycheck log, debts, checkmarks—goes back to the demo template. Saved CSVs stay on your device; this doesn’t erase those files."
          cancelLabel="Keep my data"
          confirmLabel="Reset everything"
          onConfirm={() => resetAll()}
        />
      </main>
      </div>
      {monthOpeningBlocked ? (
        <MonthCashflowOpeningModal state={state} onConfirm={completeMonthCashflowOpening} />
      ) : null}
    </div>
  );
}
