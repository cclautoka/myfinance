import { useCallback, useMemo, useRef, useState } from 'react';
import type { DebtAccount, FinanceState, IncomeConfig, ThemePreference } from '../types/finance';
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
import { markHouseholdSetupFinished, readHouseholdMode } from './setupCompletion';
import {
  setupAlertsStepSchema,
  setupDebtsStepSchema,
  setupEssentialsStepSchema,
  setupIncomeStepSchema,
  zodIssuesToRecord,
} from './setupSchema';
import { zLayers } from '../ui/zLayers';

const BASELINE_ESSENTIAL_ID = 'wizard-household-baseline-v1';

export type HouseholdSetupWizardProps = {
  state: FinanceState;
  setIncome: (income: IncomeConfig) => void;
  setEssentials: (essentials: FinanceState['essentials']) => void;
  setDebts: (debts: FinanceState['debts']) => void;
  onComplete: () => void;
  theme: ThemePreference;
  onTheme: (t: ThemePreference) => void;
};

const STEPS = ['Income & household', 'Essentials', 'Debts', 'Alerts'] as const;

export function HouseholdSetupWizard({
  state,
  setIncome,
  setEssentials,
  setDebts,
  onComplete,
  theme,
  onTheme,
}: HouseholdSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<HouseholdMode>(() => readHouseholdMode());
  const [husbandMonthly, setHusbandMonthly] = useState(() => String(state.income.husbandMonthly || ''));
  const [wifeMonthly, setWifeMonthly] = useState(() => String(state.income.wifeMonthly || ''));
  const [monthlyBaseline, setMonthlyBaseline] = useState(() => {
    const baseline = state.essentials.find((e) => e.id === BASELINE_ESSENTIAL_ID);
    return String(baseline?.amount ?? '');
  });
  const [noDebts, setNoDebts] = useState(false);
  const noDebtsClaimRef = useRef(false);
  const [debtName, setDebtName] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtMin, setDebtMin] = useState('');
  const [debtDue, setDebtDue] = useState('15');
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

  const goNext = () => {
    setErrors({});
    if (step === 0) {
      const parsed = setupIncomeStepSchema.safeParse({
        mode,
        husbandMonthly: mode === 'single' ? Number(husbandMonthly || 0) : Number(husbandMonthly || 0),
        wifeMonthly: mode === 'single' ? 0 : Number(wifeMonthly || 0),
      });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      persistMode(parsed.data.mode);
      setIncome({
        ...state.income,
        husbandMonthly: parsed.data.husbandMonthly,
        wifeMonthly: parsed.data.wifeMonthly,
      });
      setStep(1);
      return;
    }
    if (step === 1) {
      const parsed = setupEssentialsStepSchema.safeParse({ monthlyBaseline });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      const amt = parsed.data.monthlyBaseline;
      const next = state.essentials.filter((e) => e.id !== BASELINE_ESSENTIAL_ID);
      next.push({
        id: BASELINE_ESSENTIAL_ID,
        name: 'Monthly essentials (baseline)',
        amount: amt,
        cadence: 'month',
        dueDay: 1,
      });
      setEssentials(next);
      setStep(2);
      return;
    }
    if (step === 2) {
      const parsed = setupDebtsStepSchema.safeParse({
        noDebts,
        name: debtName,
        balance: debtBalance,
        monthlyPayment: debtMin,
        dueDay: debtDue,
      });
      if (!parsed.success) {
        setErrors(zodIssuesToRecord(parsed.error.issues));
        return;
      }
      noDebtsClaimRef.current = parsed.data.noDebts;
      if (parsed.data.noDebts) {
        setDebts([]);
      } else {
        const d: DebtAccount = {
          id: crypto.randomUUID(),
          name: parsed.data.name,
          balance: parsed.data.balance,
          monthlyPayment: parsed.data.monthlyPayment,
          dueDay: parsed.data.dueDay,
          autoDeduction: false,
          kind: 'loan',
        };
        setDebts([d]);
      }
      setStep(3);
      return;
    }
    if (step === 3) {
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
      markHouseholdSetupFinished(noDebtsClaimRef.current);
      onComplete();
    }
  };

  const goBack = () => {
    setErrors({});
    if (step > 0) setStep((s) => s - 1);
  };

  const z = zLayers.setupWizard;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-y-auto bg-gradient-to-br from-teal-50/95 via-white to-slate-50 dark:from-moss-bg dark:via-moss-elevated dark:to-moss-bg"
      style={{ zIndex: z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="household-setup-title"
      data-tour="household-setup"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 sm:px-6">
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
                    After tax and deductions — one number is enough to start. You can fine-tune later in Household.
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
                    Earner A monthly ($)
                    <FieldHelp label="Earner A">Planned monthly take-home after tax.</FieldHelp>
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
                    Earner B monthly ($)
                    <FieldHelp label="Earner B">Planned monthly take-home after tax.</FieldHelp>
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
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                Monthly essentials baseline ($)
                <FieldHelp label="Essentials">
                  Rough rent + utilities + food floor for the month. You will map real bills later in Essentials.
                </FieldHelp>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                  inputMode="decimal"
                  value={monthlyBaseline}
                  onChange={(e) => {
                    setMonthlyBaseline(e.target.value);
                    clearErr('monthlyBaseline');
                  }}
                  aria-invalid={Boolean(errors.monthlyBaseline)}
                  aria-describedby={errors.monthlyBaseline ? fieldErrorId('monthlyBaseline') : undefined}
                />
                <FieldError id={fieldErrorId('monthlyBaseline')} message={errors.monthlyBaseline} />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-moss-fg">
                  We are not tracking loans or cards yet
                </p>
                <SegmentedToggle
                  name="setup-no-debts"
                  aria-label="Skip debt tracking"
                  size="compact"
                  offLabel="No"
                  onLabel="Yes"
                  checked={noDebts}
                  className="w-full max-w-[11rem] shrink-0 sm:w-auto"
                  onCheckedChange={setNoDebts}
                />
              </div>
              {!noDebts ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted sm:col-span-2">
                    Account name
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      value={debtName}
                      onChange={(e) => {
                        setDebtName(e.target.value);
                        clearErr('name');
                      }}
                    />
                    <FieldError id={fieldErrorId('name')} message={errors.name} />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                    Balance owed ($)
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      inputMode="decimal"
                      value={debtBalance}
                      onChange={(e) => {
                        setDebtBalance(e.target.value);
                        clearErr('balance');
                      }}
                    />
                    <FieldError id={fieldErrorId('balance')} message={errors.balance} />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted">
                    Min payment ($)
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      inputMode="decimal"
                      value={debtMin}
                      onChange={(e) => {
                        setDebtMin(e.target.value);
                        clearErr('monthlyPayment');
                      }}
                    />
                    <FieldError id={fieldErrorId('monthlyPayment')} message={errors.monthlyPayment} />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-moss-muted sm:col-span-2">
                    Due day of month (1–31)
                    <input
                      className="mt-1 w-full max-w-[8rem] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg"
                      inputMode="numeric"
                      value={debtDue}
                      onChange={(e) => setDebtDue(e.target.value)}
                    />
                    <FieldError id={fieldErrorId('dueDay')} message={errors.dueDay} />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
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
                    Summaries use this site’s API at <code className="font-mono">{resolveNotifyRelayUrl()}</code> (same server as the app).
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

          <div className="mt-auto flex flex-wrap justify-between gap-3 pt-8">
            <button
              type="button"
              className="btn-secondary btn-secondary-sm font-bold"
              disabled={step === 0}
              onClick={goBack}
            >
              Back
            </button>
            <button type="button" className="btn-primary btn-primary-sm font-bold" onClick={goNext}>
              {step === STEPS.length - 1 ? 'Enter dashboard' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
