import { useCallback, useMemo, useState } from 'react';
import type {
  DebtAccount,
  EssentialExpense,
  FinanceState,
  IncomeConfig,
  OtherPlannedIncomeEntry,
  SavingsGoal,
  ThemePreference,
} from '../types/finance';
import { HOUSEHOLD_MODE_KEY, type HouseholdMode } from '../utils/householdMode';
import type { NotifyRelayConfig } from '../utils/notifyRelayConfig';
import {
  ensureNotifyRelayHouseholdId,
  readNotifyRelayConfig,
  resolveNotifyRelayUrl,
  writeNotifyRelayConfig,
} from '../utils/notifyRelayConfig';
import { readHouseholdSession } from '../utils/householdSession';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';
import { FieldError } from '../components/ui/FieldError';
import { fieldErrorId } from '../components/ui/fieldErrorId';
import { FieldHelp } from '../components/ui/FieldHelp';
import { SegmentedButtonGroup } from '../components/ui/SegmentedButtonGroup';
import { SegmentedChoice } from '../components/ui/SegmentedChoice';
import { THEME_SEGMENT_OPTIONS } from '../components/ui/themeSegmentedOptions';
import { NumericAmountInput } from '../components/ui/NumericInputs';
import { markHouseholdSetupFinished, readHouseholdMode } from './setupCompletion';
import {
  sanitizeOtherPlannedIncome,
  sanitizeSavingsGoals,
  sanitizeSetupDebts,
  sanitizeSetupEssentials,
  setupAlertsStepSchema,
  setupDebtsStepSchema,
  setupEssentialsStepSchema,
  setupFunMoneyStepSchema,
  setupIncomeStepSchema,
  setupSavingsStepSchema,
  zodIssuesToRecord,
} from './setupSchema';
import { SetupEssentialRows } from './SetupEssentialRows';
import { SetupDebtRows } from './SetupDebtRows';
import { SetupOtherIncomeRows } from './SetupOtherIncomeRows';
import { SetupSavingsGoalsRows } from './SetupSavingsGoalsRows';
import { createStarterDebt, createStarterEssential } from './setupIds';
import { zLayers } from '../ui/zLayers';

export type HouseholdSetupWizardProps = {
  state: FinanceState;
  setIncome: (income: IncomeConfig) => void;
  setEssentials: (essentials: FinanceState['essentials']) => void;
  setDebts: (debts: FinanceState['debts']) => void;
  onPatch: (patch: Partial<FinanceState>) => void;
  onComplete: () => void;
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
};

const STEPS = [
  'Household & income',
  'Bills & recurring costs',
  'Debts & loans',
  'Savings & backup',
  'Fun money',
  'Email heads-up',
  "You're set",
] as const;

function initEssentials(state: FinanceState): EssentialExpense[] {
  const rows = state.essentials.filter((e) => e.amount > 0 || e.name.trim());
  return rows.length > 0 ? rows : [createStarterEssential()];
}

function initDebts(state: FinanceState): DebtAccount[] {
  return state.debts.length > 0 ? state.debts : [createStarterDebt()];
}

function initOtherIncome(income: IncomeConfig): OtherPlannedIncomeEntry[] {
  if (income.otherPlannedIncome?.length) return income.otherPlannedIncome;
  const legacy = Number(income.otherPlannedMonthly ?? 0);
  if (legacy > 0) {
    return [{ id: 'legacy-other-planned', label: 'Other income', amount: legacy }];
  }
  return [];
}

function initSavingsGoals(state: FinanceState): SavingsGoal[] {
  if (state.savingsGoals?.length) return state.savingsGoals;
  if (state.threeMonthFundTarget > 0) {
    return [
      {
        id: 'legacy-three-month',
        name: '3-month cushion',
        targetAmount: state.threeMonthFundTarget,
        balance: Math.min(state.emergencyFund, state.threeMonthFundTarget),
      },
    ];
  }
  return [];
}

export function HouseholdSetupWizard({
  state,
  setIncome,
  setEssentials,
  setDebts,
  onPatch,
  onComplete,
  theme,
  onTheme,
}: HouseholdSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<HouseholdMode>(() => readHouseholdMode());
  const [husbandMonthly, setHusbandMonthly] = useState(() => String(state.income.husbandMonthly || ''));
  const [wifeMonthly, setWifeMonthly] = useState(() => String(state.income.wifeMonthly || ''));
  const [otherIncomeRows, setOtherIncomeRows] = useState<OtherPlannedIncomeEntry[]>(() =>
    initOtherIncome(state.income),
  );
  const [essentialRows, setEssentialRows] = useState<EssentialExpense[]>(() => initEssentials(state));
  const [debtRows, setDebtRows] = useState<DebtAccount[]>(() => initDebts(state));
  const [plannedSavingsMonthly, setPlannedSavingsMonthly] = useState(() =>
    String(state.plannedSavingsMonthly || ''),
  );
  const [emergencyFund, setEmergencyFund] = useState(() => String(state.emergencyFund || ''));
  const [savingsGoalRows, setSavingsGoalRows] = useState<SavingsGoal[]>(() => initSavingsGoals(state));
  const [plannedPersonalMonthly, setPlannedPersonalMonthly] = useState(() =>
    String(state.plannedPersonalMonthly || ''),
  );
  const [husbandBudget, setHusbandBudget] = useState(() => String(state.wallets.husbandBudget || ''));
  const [wifeBudget, setWifeBudget] = useState(() => String(state.wallets.wifeBudget || ''));
  const cfg0 = useMemo(() => readNotifyRelayConfig(), []);
  const [alertsEnabled, setAlertsEnabled] = useState(cfg0.enabled);
  const [householdId] = useState(() => {
    const sess = readHouseholdSession();
    return (sess?.householdId?.trim() || cfg0.householdId.trim() || ensureNotifyRelayHouseholdId());
  });
  const [hEmail, setHEmail] = useState(cfg0.husbandEmail);
  const [wEmail, setWEmail] = useState(cfg0.wifeEmail);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const persistMode = useCallback((m: HouseholdMode) => {
    setMode(m);
    try {
      localStorage.setItem(HOUSEHOLD_MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const clearErr = (k: string) => {
    setErrors((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
  };

  const walletGapWarning =
    mode === 'couple' &&
    Number(plannedPersonalMonthly || 0) > 0 &&
    Number(husbandBudget || 0) + Number(wifeBudget || 0) >
      Number(plannedPersonalMonthly || 0) + 5;

  const finishSetup = () => {
    markHouseholdSetupFinished();
    onComplete();
  };

  const goNext = () => {
    setErrors({});
    if (step === 0) {
      const parsed = setupIncomeStepSchema.safeParse({
        mode,
        husbandMonthly: Number(husbandMonthly || 0),
        wifeMonthly: mode === 'single' ? 0 : Number(wifeMonthly || 0),
        otherPlannedIncome: otherIncomeRows,
      });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      persistMode(parsed.data.mode);
      const otherPlannedIncome = sanitizeOtherPlannedIncome(parsed.data.otherPlannedIncome);
      setOtherIncomeRows(otherPlannedIncome);
      setIncome({
        ...state.income,
        husbandMonthly: parsed.data.husbandMonthly,
        wifeMonthly: parsed.data.wifeMonthly,
        otherPlannedIncome,
        otherPlannedMonthly: 0,
      });
      setStep(1);
      return;
    }
    if (step === 1) {
      const parsed = setupEssentialsStepSchema.safeParse({ rows: essentialRows });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      const next = sanitizeSetupEssentials(essentialRows);
      setEssentials(next);
      setEssentialRows(next);
      setStep(2);
      return;
    }
    if (step === 2) {
      const parsed = setupDebtsStepSchema.safeParse({ rows: debtRows });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      const next = sanitizeSetupDebts(debtRows);
      setDebts(next);
      setDebtRows(next.length > 0 ? next : [createStarterDebt()]);
      setStep(3);
      return;
    }
    if (step === 3) {
      const parsed = setupSavingsStepSchema.safeParse({
        plannedSavingsMonthly: plannedSavingsMonthly || 0,
        emergencyFund: emergencyFund || 0,
        goals: savingsGoalRows,
      });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      const goals = sanitizeSavingsGoals(savingsGoalRows);
      setSavingsGoalRows(goals);
      const legacyThreeMonth =
        goals.length > 0 ? Math.max(...goals.map((g) => g.targetAmount)) : 0;
      onPatch({
        plannedSavingsMonthly: parsed.data.plannedSavingsMonthly,
        emergencyFund: parsed.data.emergencyFund,
        savingsGoals: goals,
        threeMonthFundTarget: legacyThreeMonth,
      });
      setStep(4);
      return;
    }
    if (step === 4) {
      const personal = Number(plannedPersonalMonthly || 0);
      const hBudget = mode === 'single' ? personal : Number(husbandBudget || 0);
      const wBudget = mode === 'single' ? 0 : Number(wifeBudget || 0);
      const parsed = setupFunMoneyStepSchema.safeParse({
        mode,
        plannedPersonalMonthly: personal,
        husbandBudget: hBudget,
        wifeBudget: wBudget,
      });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      onPatch({
        plannedPersonalMonthly: parsed.data.plannedPersonalMonthly,
        wallets: {
          ...state.wallets,
          husbandBudget: parsed.data.husbandBudget,
          wifeBudget: parsed.data.wifeBudget,
          husbandSpent: 0,
          wifeSpent: 0,
        },
      });
      setStep(5);
      return;
    }
    if (step === 5) {
      const parsed = setupAlertsStepSchema.safeParse({
        enabled: alertsEnabled,
        householdId,
        husbandEmail: hEmail,
        wifeEmail: wEmail,
      });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      const nextCfg: NotifyRelayConfig = {
        enabled: parsed.data.enabled,
        url: resolveNotifyRelayUrl(),
        secret: cfg0.secret,
        husbandEmail: parsed.data.husbandEmail.trim(),
        wifeEmail: parsed.data.wifeEmail.trim(),
        householdId: parsed.data.householdId.trim(),
      };
      writeNotifyRelayConfig(nextCfg);
      setStep(6);
      return;
    }
  };

  const goBack = () => {
    setErrors({});
    if (step > 0) setStep((s) => s - 1);
  };

  const z = zLayers.setupWizard;
  const isFinish = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-gradient-to-br from-teal-50/95 via-white to-slate-50 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg"
      style={{ zIndex: z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="household-setup-title"
      data-tour="household-setup"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:max-w-4xl sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300/90">
              First-time setup
            </p>
            <h1 id="household-setup-title" className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-moss-fg">
              Household finances
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-moss-subtle">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </p>
          </div>
          <div className="w-full max-w-[11.5rem] shrink-0 sm:max-w-[13rem]">
            <SegmentedButtonGroup
              aria-label="Color theme"
              value={theme}
              onChange={onTheme}
              options={THEME_SEGMENT_OPTIONS}
              size="compact"
            />
          </div>
        </div>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-moss-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 transition-all duration-300 dark:from-teal-500 dark:to-emerald-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-8 flex flex-1 flex-col rounded-xl border-2 border-slate-200/90 border-t-teal-600 bg-white p-5 shadow-md dark:border-moss-border dark:border-t-teal-500 dark:bg-moss-surface dark:shadow-black/25">
          {step === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 dark:text-moss-subtle">Who is this workbook for?</p>
              <fieldset>
                <legend className="sr-only">Household mode</legend>
                <div className="max-w-md">
                  <SegmentedChoice
                    name="household-mode-setup"
                    aria-label="Household mode"
                    value={mode}
                    onChange={persistMode}
                    options={[
                      { id: 'single', label: 'Single' },
                      { id: 'couple', label: 'Couple / shared' },
                    ]}
                  />
                </div>
              </fieldset>
              {mode === 'single' ? (
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                  Planned monthly take-home ($)
                  <FieldHelp label="Income">
                    After tax and deductions — one number is enough to start.
                  </FieldHelp>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    inputMode="decimal"
                    value={husbandMonthly}
                    onChange={(e) => {
                      setHusbandMonthly(e.target.value);
                      clearErr('husbandMonthly');
                    }}
                    aria-invalid={Boolean(errors.husbandMonthly)}
                    aria-describedby={errors.husbandMonthly ? fieldErrorId('husbandMonthly') : undefined}
                  />
                  <FieldError id={fieldErrorId('husbandMonthly')} message={errors.husbandMonthly} />
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                    Husband monthly ($)
                    <FieldHelp label="Husband">Planned monthly take-home after tax.</FieldHelp>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      inputMode="decimal"
                      value={husbandMonthly}
                      onChange={(e) => {
                        setHusbandMonthly(e.target.value);
                        clearErr('husbandMonthly');
                      }}
                      aria-invalid={Boolean(errors.husbandMonthly)}
                      aria-describedby={errors.husbandMonthly ? fieldErrorId('husbandMonthly') : undefined}
                    />
                    <FieldError id={fieldErrorId('husbandMonthly')} message={errors.husbandMonthly} />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                    Wife monthly ($)
                    <FieldHelp label="Wife">Planned monthly take-home after tax.</FieldHelp>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      inputMode="decimal"
                      value={wifeMonthly}
                      onChange={(e) => {
                        setWifeMonthly(e.target.value);
                        clearErr('wifeMonthly');
                      }}
                    />
                  </label>
                </div>
              )}
              <SetupOtherIncomeRows rows={otherIncomeRows} onChange={setOtherIncomeRows} />
              <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-moss-border dark:bg-moss-surface/80 dark:text-moss-subtle">
                Bonuses, gifts, and one-off cash can be added later on the Dashboard — only add rows here if the money
                is steady every month. Each row counts toward planned income on your tracker.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <SetupEssentialRows rows={essentialRows} onChange={setEssentialRows} errors={errors} />
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-moss-subtle">
                Add every loan, card, and HP payment — remove rows you do not have. They feed the bill calendar and debt
                totals like in Your numbers.
              </p>
              <SetupDebtRows rows={debtRows} onChange={setDebtRows} errors={errors} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
                Planned savings is how much you intend to set aside each month. Emergency balance is what is already in
                your saver today.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Planned savings (this month) ($)
                <NumericAmountInput
                  min={0}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  value={Number(plannedSavingsMonthly || 0)}
                  onValueChange={(n) => setPlannedSavingsMonthly(String(n))}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Balance in emergency / joint savings ($)
                <NumericAmountInput
                  min={0}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  value={Number(emergencyFund || 0)}
                  onValueChange={(n) => setEmergencyFund(String(n))}
                />
              </label>
              <SetupSavingsGoalsRows rows={savingsGoalRows} onChange={setSavingsGoalRows} errors={errors} />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-muted">
                Fun money is your discretionary envelope — split it between partners in couple mode, or use one amount
                when you are on your own.
              </p>
              {mode === 'single' ? (
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                  Monthly fun money ($)
                  <NumericAmountInput
                    min={0}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                    value={Number(plannedPersonalMonthly || husbandBudget || 0)}
                    onValueChange={(n) => {
                      setPlannedPersonalMonthly(String(n));
                      setHusbandBudget(String(n));
                      setWifeBudget('0');
                    }}
                  />
                </label>
              ) : (
                <>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                    Planned personal / fun envelope ($)
                    <NumericAmountInput
                      min={0}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      value={Number(plannedPersonalMonthly || 0)}
                      onValueChange={(n) => setPlannedPersonalMonthly(String(n))}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                      Husband wallet ($)
                      <NumericAmountInput
                        min={0}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                        value={Number(husbandBudget || 0)}
                        onValueChange={(n) => setHusbandBudget(String(n))}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                      Wife wallet ($)
                      <NumericAmountInput
                        min={0}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                        value={Number(wifeBudget || 0)}
                        onValueChange={(n) => setWifeBudget(String(n))}
                      />
                    </label>
                  </div>
                  {walletGapWarning ? (
                    <p className="text-xs font-medium text-amber-900 dark:text-amber-100/90">
                      Wallets total more than the planned personal envelope — you can adjust either in the app later.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-moss-fg">
                  Email heads-up from my relay (optional)
                </p>
                <SegmentedToggle
                  name="setup-alerts"
                  aria-label="Email alert summaries"
                  size="compact"
                  checked={alertsEnabled}
                  className="w-full max-w-[11rem] shrink-0 sm:w-auto"
                  onCheckedChange={setAlertsEnabled}
                />
              </div>
              {alertsEnabled ? (
                <div className="grid gap-3">
                  <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-moss-border dark:bg-moss-surface/80 dark:text-moss-subtle">
                    Summaries use this site’s API at <code className="font-mono">{resolveNotifyRelayUrl()}</code> (same
                    server as the app).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                      Recipient email A
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                        type="email"
                        autoComplete="email"
                        value={hEmail}
                        onChange={(e) => {
                          setHEmail(e.target.value);
                          clearErr('husbandEmail');
                        }}
                      />
                      <FieldError id={fieldErrorId('husbandEmail')} message={errors.husbandEmail} />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                      Recipient email B
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                        type="email"
                        value={wEmail}
                        onChange={(e) => setWEmail(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-moss-subtle">
                  You can enable alerts later under Tools. For now we will keep relay off.
                </p>
              )}
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-700 dark:text-moss-subtle">
                You are ready to use the dashboard. Everything you entered here can be changed anytime:
              </p>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-700 dark:text-moss-subtle">
                <li>
                  <strong className="text-slate-900 dark:text-moss-fg">Workspace → Your numbers</strong> — income,
                  bills, debts, and bill timing
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-moss-fg">Workspace → Plan & bills</strong> — monthly
                  split, fun money wallets, and emergency savings
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-moss-fg">Dashboard</strong> — check off bills, log extra
                  cash, and track the month
                </li>
              </ul>
              <p className="text-sm text-slate-600 dark:text-moss-muted">
                This setup is just to get you started with real numbers — refine as you go.
              </p>
            </div>
          ) : null}

          <div className="mt-auto flex flex-wrap justify-between gap-3 pt-8">
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={step === 0}
              onClick={goBack}
            >
              Back
            </button>
            {isFinish ? (
              <button type="button" className="btn-primary btn-primary-sm font-bold" onClick={finishSetup}>
                Enter dashboard
              </button>
            ) : (
              <button type="button" className="btn-primary btn-primary-sm font-bold" onClick={goNext}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
