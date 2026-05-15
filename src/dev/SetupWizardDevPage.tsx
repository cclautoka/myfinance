import { useCallback, useState } from 'react';
import type { FinanceState, IncomeConfig, ThemePreference } from '../types/finance';
import { HouseholdSetupWizard } from '../setup/HouseholdSetupWizard';
import { HOUSEHOLD_MODE_KEY } from '../utils/householdMode';
import { createSetupWizardDummyState } from './setupWizardDummyState';

/**
 * Dev-only full-screen preview of the post-registration setup wizard.
 * Visit: /dev/setup-wizard (Vite dev server only — not routed in production builds).
 */
export function SetupWizardDevPage() {
  const [state, setState] = useState<FinanceState>(() => createSetupWizardDummyState());
  const [completed, setCompleted] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  const [lastAction, setLastAction] = useState<string>('—');

  const log = useCallback((label: string) => {
    setLastAction(`${label} @ ${new Date().toLocaleTimeString()}`);
  }, []);

  const setIncome = useCallback((income: IncomeConfig) => {
    setState((s) => ({ ...s, income }));
    log('setIncome');
  }, [log]);

  const setEssentials = useCallback((essentials: FinanceState['essentials']) => {
    setState((s) => ({ ...s, essentials }));
    log(`setEssentials (${essentials.length} rows)`);
  }, [log]);

  const setDebts = useCallback((debts: FinanceState['debts']) => {
    setState((s) => ({ ...s, debts }));
    log(`setDebts (${debts.length} rows)`);
  }, [log]);

  const onPatch = useCallback((patch: Partial<FinanceState>) => {
    setState((s) => ({ ...s, ...patch }));
    log(`onPatch: ${Object.keys(patch).join(', ')}`);
  }, [log]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setState((s) => ({ ...s, theme }));
    log(`theme → ${theme}`);
  }, [log]);

  const resetPreview = () => {
    try {
      localStorage.setItem(HOUSEHOLD_MODE_KEY, 'couple');
    } catch {
      /* ignore */
    }
    setState(createSetupWizardDummyState());
    setCompleted(false);
    setWizardKey((k) => k + 1);
    setLastAction('reset preview');
  };

  const setSingleMode = () => {
    try {
      localStorage.setItem(HOUSEHOLD_MODE_KEY, 'single');
    } catch {
      /* ignore */
    }
    setState((s) => ({
      ...s,
      income: { ...s.income, wifeMonthly: 0 },
      wallets: { ...s.wallets, wifeBudget: 0 },
    }));
    setCompleted(false);
    setWizardKey((k) => k + 1);
    log('mode → single');
  };

  if (completed) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-slate-100 p-6 dark:bg-moss-bg">
        <p className="max-w-md text-center text-sm text-slate-700 dark:text-moss-subtle">
          Wizard called <strong>onComplete</strong> — in the real app you would land on the dashboard. State
          below is what the wizard wrote into memory during the preview.
        </p>
        <pre className="max-h-[50vh] w-full max-w-2xl overflow-auto rounded-xl border border-slate-300 bg-white p-4 text-left text-xs dark:border-moss-border dark:bg-moss-surface">
          {JSON.stringify(state, null, 2)}
        </pre>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary btn-primary-sm" onClick={() => setCompleted(false)}>
            Show wizard again
          </button>
          <button type="button" className="btn-secondary btn-secondary-sm" onClick={resetPreview}>
            Reset dummy data
          </button>
          <a href="/" className="btn-secondary btn-secondary-sm">
            Back to app
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-[10000] flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/60 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/90 dark:text-amber-100"
        role="status"
      >
        <span>
          DEV — Setup wizard preview · <span className="font-normal opacity-90">Last: {lastAction}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-amber-200/80 px-2 py-1 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800"
            onClick={setSingleMode}
          >
            Force single mode
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-200/80 px-2 py-1 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800"
            onClick={resetPreview}
          >
            Reset dummy data
          </button>
          <a
            href="/"
            className="rounded-lg bg-amber-200/80 px-2 py-1 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800"
          >
            Exit preview
          </a>
        </div>
      </div>
      <HouseholdSetupWizard
        key={wizardKey}
        state={state}
        setIncome={setIncome}
        setEssentials={setEssentials}
        setDebts={setDebts}
        onPatch={onPatch}
        onComplete={() => {
          log('onComplete');
          setCompleted(true);
        }}
        theme={state.theme}
        onTheme={setTheme}
      />
    </>
  );
}
