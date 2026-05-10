import type { ReactNode } from 'react';
import { useState } from 'react';
import type {
  DebtAccount,
  DebtKind,
  EssentialExpense,
  FinanceState,
  PaySchedule,
} from '../types/finance';
import { householdDataTip } from '../copy/tooltips';
import {
  DEBT_KIND_OPTIONS,
  ESSENTIAL_CADENCE_OPTIONS,
  PAY_SCHEDULE_OPTIONS,
  WEEKLY_ESSENTIAL_DAY_OPTIONS,
} from '../data/selectOptions';
import { Card } from './ui/Card';
import { ConfirmDialog } from './ui/ConfirmDialog';
import {
  NumericAmountInput,
  NumericIntegerInput,
  OptionalMonthDayInput,
} from './ui/NumericInputs';
import { HoverTip } from './ui/HoverTip';
import { ListboxSelect } from './ui/ListboxSelect';
import { ScheduledPayAutomationFields } from './ScheduledPayAutomationFields';

type EditorDialogState =
  | null
  | {
      variant: 'default' | 'danger';
      title: string;
      description: string;
      confirmLabel: string;
      cancelLabel?: string;
      showCancel: boolean;
      onConfirm?: () => void;
    };

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-sage-700 dark:text-moss-subtle">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export function DataEditor({
  state,
  onEssentials,
  onDebts,
  onIncome,
  patchState,
}: {
  state: FinanceState;
  onEssentials: (e: EssentialExpense[]) => void;
  onDebts: (d: DebtAccount[]) => void;
  onIncome: (i: FinanceState['income']) => void;
  patchState: (p: Partial<FinanceState>) => void;
}) {
  const [dialog, setDialog] = useState<EditorDialogState>(null);

  const patchEssential = (id: string, patch: Partial<EssentialExpense>) => {
    onEssentials(state.essentials.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const patchDebt = (id: string, patch: Partial<DebtAccount>) => {
    onDebts(state.debts.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const addEssential = () => {
    onEssentials([
      ...state.essentials,
      { id: newId('ess'), name: 'New expense / savings target', amount: 0, cadence: 'month' },
    ]);
  };

  const removeEssential = (id: string) => {
    if (state.essentials.length <= 1) {
      setDialog({
        variant: 'default',
        title: 'Keep at least one row',
        description:
          'The plan needs one essential-expense row as a baseline. Rename or rewrite it—but don’t empty the sheet entirely.',
        confirmLabel: 'Got it',
        showCancel: false,
      });
      return;
    }
    const rowLabel = state.essentials.find((x) => x.id === id)?.name ?? 'this row';
    setDialog({
      variant: 'danger',
      title: 'Remove expense row?',
      description: `“${rowLabel}” disappears from timelines and totals. You can always add another row later—nothing is synced to the bank.`,
      confirmLabel: 'Remove row',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => onEssentials(state.essentials.filter((x) => x.id !== id)),
    });
  };

  const addDebt = () => {
    onDebts([
      ...state.debts,
      {
        id: newId('debt'),
        name: 'New loan / HP / payment',
        balance: 0,
        monthlyPayment: 0,
        dueDay: 1,
        autoDeduction: false,
        endsOn: null,
        kind: 'loan',
        annualInterestApr: 0,
      },
    ]);
  };

  const removeDebt = (id: string) => {
    const rowLabel = state.debts.find((x) => x.id === id)?.name ?? 'this debt row';
    setDialog({
      variant: 'danger',
      title: 'Remove debt row?',
      description: `“${rowLabel}” drops off balances and scheduled payments here. Undo isn’t automatic—add the row again if you removed it by mistake.`,
      confirmLabel: 'Remove debt row',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => onDebts(state.debts.filter((x) => x.id !== id)),
    });
  };

  return (
    <>
      {dialog && (
        <ConfirmDialog
          open
          variant={dialog.variant}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          showCancel={dialog.showCancel}
          onClose={() => setDialog(null)}
          onConfirm={dialog.onConfirm}
        />
      )}
    <Card
      title="Line-by-line edits"
      subtitle="Everything upstairs reads these rows — paychecks first, bills next, debts last."
    >
      <HoverTip content={householdDataTip()}>
        <p className="mb-6 cursor-default rounded-xl border-2 border-dashed border-sage-400/70 px-3 py-2 text-xs font-semibold text-sage-700 dark:border-moss-border dark:text-moss-muted">
          Why this block matters → hover once.
        </p>
      </HoverTip>
      <div className="space-y-8">
        <section>
          <h3 className="mb-3 font-display text-lg font-bold text-sage-900 dark:text-moss-fg">
            Paychecks & timing
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Husband monthly">
              <NumericAmountInput
                min={0}
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.income.husbandMonthly}
                onValueChange={(n) => onIncome({ ...state.income, husbandMonthly: n })}
              />
            </Field>
            <Field label="Wife monthly">
              <NumericAmountInput
                min={0}
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.income.wifeMonthly}
                onValueChange={(n) => onIncome({ ...state.income, wifeMonthly: n })}
              />
            </Field>
            <Field label="Husband usual pay rhythm">
              <ListboxSelect
                ariaLabel="Husband usual pay rhythm"
                buttonClassName="min-w-0 rounded-lg px-2 py-1.5 shadow-none"
                value={state.income.husbandPaySchedule}
                options={[...PAY_SCHEDULE_OPTIONS]}
                onChange={(v) =>
                  onIncome({ ...state.income, husbandPaySchedule: v as PaySchedule })
                }
              />
            </Field>
            <Field label="Wife usual pay rhythm">
              <ListboxSelect
                ariaLabel="Wife usual pay rhythm"
                buttonClassName="min-w-0 rounded-lg px-2 py-1.5 shadow-none"
                value={state.income.wifePaySchedule}
                options={[...PAY_SCHEDULE_OPTIONS]}
                onChange={(v) =>
                  onIncome({ ...state.income, wifePaySchedule: v as PaySchedule })
                }
              />
            </Field>
            <Field label="Husband usual amount per cheque (0 = infer from monthly)">
              <NumericAmountInput
                min={0}
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.income.husbandTypicalPerPay}
                onValueChange={(n) => onIncome({ ...state.income, husbandTypicalPerPay: n })}
              />
            </Field>
            <Field label="Wife usual amount per cheque (0 = infer from monthly)">
              <NumericAmountInput
                min={0}
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.income.wifeTypicalPerPay}
                onValueChange={(n) => onIncome({ ...state.income, wifeTypicalPerPay: n })}
              />
            </Field>
            <div className="sm:col-span-2 grid gap-4 lg:grid-cols-2">
              <ScheduledPayAutomationFields earner="husband" income={state.income} onIncome={onIncome} />
              <ScheduledPayAutomationFields earner="wife" income={state.income} onIncome={onIncome} />
            </div>
            <Field label="Husband pay notes">
              <input
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.income.husbandPayNote}
                onChange={(e) =>
                  onIncome({ ...state.income, husbandPayNote: e.target.value })
                }
              />
            </Field>
            <Field label="Wife pay notes">
              <input
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.income.wifePayNote}
                onChange={(e) => onIncome({ ...state.income, wifePayNote: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-sage-900 dark:text-moss-fg">
              Essential expenses
            </h3>
            <button type="button" onClick={addEssential} className="btn-primary btn-primary-sm">
              + Add expense / savings row
            </button>
          </div>
          <p className="mb-3 text-xs text-sage-700 dark:text-moss-muted">
            Weekly rows use <strong className="text-sage-900 dark:text-moss-tip">4 weeks per month</strong> in totals ($150/week → $600/mo). On the timeline, each weekly row uses the <strong>due weekday</strong> you pick below (defaults to{' '}
            <strong>Saturday</strong> if you never change it).{' '}
            <strong className="text-sage-900 dark:text-moss-tip">Monthly</strong> rows use a calendar <strong>due day</strong> (1–31); if you leave it blank the app assumes the 15th — set rent to the 22nd here if that matches your bill.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-sage-600 dark:text-moss-muted">
                  <th className="pb-2 pr-2">Name</th>
                  <th className="pb-2 pr-2">Amount</th>
                  <th className="pb-2 pr-2">Cadence</th>
                  <th className="pb-2 pr-2">Due</th>
                  <th className="pb-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {state.essentials.map((ex) => (
                  <tr key={ex.id} className="border-t border-sage-200/80 dark:border-moss-border">
                    <td className="py-2 pr-2">
                      <input
                        className="w-full min-w-[8rem] rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        value={ex.name}
                        onChange={(e) => patchEssential(ex.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <NumericAmountInput
                        min={0}
                        className="w-full max-w-[7rem] rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        value={ex.amount}
                        onValueChange={(n) => patchEssential(ex.id, { amount: n })}
                      />
                    </td>
                    <td className="py-2 pr-2 align-middle">
                      <ListboxSelect
                        ariaLabel={`Cadence for ${ex.name}`}
                        popoverFixed
                        buttonClassName="min-w-0 w-full max-w-[9rem] rounded-lg px-2 py-1 text-xs shadow-none"
                        value={ex.cadence}
                        options={[...ESSENTIAL_CADENCE_OPTIONS]}
                        onChange={(v) => {
                          const cadence = v as EssentialExpense['cadence'];
                          patchEssential(ex.id, {
                            cadence,
                            ...(cadence === 'week'
                              ? { dueDay: undefined, weeklyDueWeekday: ex.weeklyDueWeekday ?? 6 }
                              : { weeklyDueWeekday: undefined }),
                          });
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2 align-middle">
                      {ex.cadence === 'month' ? (
                        <OptionalMonthDayInput
                          title="Day of month this bill is due"
                          className="w-full max-w-[4.5rem] rounded border border-sage-300 bg-white px-2 py-1 tabular-nums dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                          placeholder="15"
                          value={ex.dueDay}
                          onValueChange={(n) => patchEssential(ex.id, { dueDay: n })}
                        />
                      ) : (
                        <ListboxSelect
                          ariaLabel={`Due weekday for ${ex.name}`}
                          popoverFixed
                          buttonClassName="min-w-0 w-full max-w-[9rem] rounded-lg px-2 py-1 text-xs shadow-none"
                          value={String(ex.weeklyDueWeekday ?? 6)}
                          options={[...WEEKLY_ESSENTIAL_DAY_OPTIONS]}
                          onChange={(v) => {
                            const d = Number(v);
                            if (!Number.isFinite(d) || d < 0 || d > 6) return;
                            patchEssential(ex.id, { weeklyDueWeekday: d });
                          }}
                        />
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium text-sage-600 underline hover:text-sage-900 dark:text-moss-muted dark:hover:text-sage-50"
                        onClick={() => removeEssential(ex.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-display text-lg font-bold text-sage-900 dark:text-moss-fg">
            Bill timing & warnings
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-sage-700 dark:text-moss-muted">
            <strong className="text-sage-900 dark:text-moss-tip">Overdue delay</strong> adds calendar days after the due date before we
            show the red <strong className="text-sage-900 dark:text-moss-tip">WARNING</strong> (for example if money usually leaves a
            day late). <strong className="text-sage-900 dark:text-moss-tip">Closing in</strong> counts <strong>Monday–Friday</strong>{' '}
            only — a softer heads-up before dues land.
          </p>
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Field label="Overdue delay (calendar days)">
              <NumericIntegerInput
                min={0}
                max={60}
                hideZeroWhenBlurred
                title="Whole calendar days — blur to commit"
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.billOverdueGraceDays ?? 0}
                onValueChange={(n) =>
                  patchState({
                    billOverdueGraceDays: Math.min(60, Math.max(0, n)),
                  })
                }
              />
            </Field>
            <Field label="Closing-in window (business days)">
              <NumericIntegerInput
                min={1}
                max={30}
                title="Whole business days — blur to commit"
                className="w-full rounded-lg border border-sage-300 bg-white px-2 py-1.5 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                value={state.billUpcomingLeadBusinessDays ?? 3}
                onValueChange={(n) =>
                  patchState({
                    billUpcomingLeadBusinessDays:
                      Math.min(30, Math.max(1, n || 3)),
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-sage-900 dark:text-moss-fg">
              Debts & loans
            </h3>
            <button type="button" onClick={addDebt} className="btn-primary btn-primary-sm">
              + Add loan / HP / payment
            </button>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-sage-700 dark:text-moss-muted">
            <strong className="text-sage-900 dark:text-moss-tip">Balance</strong> is what you type from the bank (we never add
            interest into it for you). For credit cards, refresh it when the statement drops. Optional <strong className="text-sage-900 dark:text-moss-tip">APR %</strong>{' '}
            only powers a rough “interest this month” hint on the Card &amp; loan balances card — it does not change stored
            balances.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-sage-600 dark:text-moss-muted">
                  <th className="pb-2 pr-2">Type</th>
                  <th className="pb-2 pr-2">Name</th>
                  <th className="pb-2 pr-2">Balance</th>
                  <th className="pb-2 pr-2">APR %</th>
                  <th className="pb-2 pr-2">Payment</th>
                  <th className="pb-2 pr-2">Due day</th>
                  <th className="pb-2 pr-2">Auto</th>
                  <th className="pb-2 pr-2">Ends (ISO)</th>
                  <th className="pb-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {state.debts.map((d) => (
                  <tr key={d.id} className="border-t border-sage-200/80 dark:border-moss-border">
                    <td className="py-2 pr-2 align-middle">
                      <ListboxSelect
                        ariaLabel={`Account type for ${d.name}`}
                        popoverFixed
                        buttonClassName="min-w-0 w-[10rem] max-w-[10.5rem] rounded-lg px-2 py-1 text-xs shadow-none"
                        value={d.kind}
                        options={[...DEBT_KIND_OPTIONS]}
                        onChange={(v) => patchDebt(d.id, { kind: v as DebtKind })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-44 rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        value={d.name}
                        onChange={(e) => patchDebt(d.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <NumericAmountInput
                        min={0}
                        className="w-28 rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        title="Statement balance (manual)"
                        value={d.balance}
                        onValueChange={(n) => patchDebt(d.id, { balance: n })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <NumericAmountInput
                        min={0}
                        max={60}
                        placeholder="—"
                        className="w-20 rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        title="Annual % optional — estimate only"
                        value={d.annualInterestApr ?? 0}
                        onValueChange={(n) => patchDebt(d.id, { annualInterestApr: Math.max(0, n) })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <NumericAmountInput
                        min={0}
                        className="w-24 rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        value={d.monthlyPayment}
                        onValueChange={(n) => patchDebt(d.id, { monthlyPayment: n })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <NumericIntegerInput
                        min={1}
                        max={31}
                        emptyBlurRestoresCurrent
                        className="w-16 rounded border border-sage-300 bg-white px-2 py-1 tabular-nums dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        value={d.dueDay}
                        onValueChange={(n) => patchDebt(d.id, { dueDay: n })}
                      />
                    </td>
                    <td className="py-2 pr-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-moss-accent"
                        checked={d.autoDeduction}
                        onChange={(e) => patchDebt(d.id, { autoDeduction: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-32 rounded border border-sage-300 bg-white px-2 py-1 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
                        value={d.endsOn ?? ''}
                        placeholder="YYYY-MM-DD"
                        onChange={(e) =>
                          patchDebt(d.id, { endsOn: e.target.value || null })
                        }
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium text-sage-600 underline hover:text-sage-900 dark:text-moss-muted dark:hover:text-sage-50"
                        onClick={() => removeDebt(d.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Card>
    </>
  );
}
