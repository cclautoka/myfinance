import type { FinanceState, SavingsGoal } from '../types/finance';
import { emergencySectionTip, ringFirst1kTip } from '../copy/tooltips';
import { allocationBreakdown } from '../utils/allocation';
import { formatMoney } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { ProgressRing } from './ui/ProgressRing';
import { NumericAmountInput } from './ui/NumericInputs';
import { SetupSavingsGoalsRows } from '../setup/SetupSavingsGoalsRows';
import { sanitizeSavingsGoals } from '../setup/setupSchema';

export function EmergencyFund({
  state,
  onFund,
  onTarget,
  onSavingsGoals,
  mode = 'allocate',
}: {
  state: FinanceState;
  onFund: (n: number) => void;
  onTarget: (n: number) => void;
  onSavingsGoals: (goals: SavingsGoal[]) => void;
  /** `allocate`: balance edits here (legacy). `manage`: goal definition + withdraw only. */
  mode?: 'allocate' | 'manage';
}) {
  const br = allocationBreakdown(state);
  const monthlyFloor = Math.max(1, br.essentials + br.debt);
  const suggested3 = monthlyFloor * 3;
  const goals = state.savingsGoals ?? [];

  const k1 = Math.min(1, state.emergencyFund / 1000);
  const k3 =
    goals.length === 0
      ? Math.min(1, state.emergencyFund / Math.max(state.threeMonthFundTarget, 1))
      : 0;

  const syncLegacyTarget = (nextGoals: SavingsGoal[]) => {
    const top = nextGoals.length > 0 ? Math.max(...nextGoals.map((g) => g.targetAmount)) : 0;
    if (top !== state.threeMonthFundTarget) onTarget(top);
  };

  return (
    <Card
      title="Backup (emergency) account"
      subtitle="Type whatever is really sitting in your joint saver — the app never reads the bank."
    >
      <div className="mb-6 rounded-xl border-2 border-sage-300/60 bg-sage-50 px-4 py-3 text-sm font-medium leading-snug text-sage-900 dark:border-moss-border dark:bg-moss-surface/90 dark:text-moss-subtle">
        <p>
          Change the balance after every transfer or statement check. Quick +$25 / +$50 / +$100 buttons only bump what you
          typed.
        </p>
        <p className="mt-2">
          <span className="font-bold dark:text-moss-fg">Two different ideas: </span>
          planned savings from the monthly split is your goal lane from income; this box is the{' '}
          <em>cash that is already in the emergency account</em>.
        </p>
      </div>

      <HoverTip content={emergencySectionTip()}>
        <p className="mb-6 cursor-default rounded-xl border-2 border-dashed border-sage-400/70 px-3 py-2 text-xs font-semibold text-sage-700 dark:border-moss-border dark:text-moss-muted">
          Hover for planned savings lane vs this balance.
        </p>
      </HoverTip>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-around">
        <ProgressRing value={k1} label="First $1,000" sublabel="A breathing milestone" tip={ringFirst1kTip()} />
        {goals.map((g) => (
          <ProgressRing
            key={g.id}
            value={Math.min(1, g.balance / Math.max(g.targetAmount, 1))}
            label={g.name}
            sublabel={`${formatMoney(g.balance)} of ${formatMoney(g.targetAmount)}`}
            tip={`Progress toward “${g.name}” — update saved so far when you move money.`}
          />
        ))}
        {goals.length === 0 && state.threeMonthFundTarget > 0 ? (
          <ProgressRing
            value={k3}
            label="Extended reserve target"
            sublabel={`Target ${formatMoney(state.threeMonthFundTarget)}`}
            tip={`Suggested ~${formatMoney(suggested3)} from essentials + debt — edit goals below instead.`}
          />
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-sage-700 dark:text-moss-subtle">
            Balance in your emergency / joint savings (you type){' '}
            <HoverTip
              content={
                <>
                  Whatever is in your real pot today — e.g. Westpac joint saver. Update after each transfer or when you
                  check internet banking.
                </>
              }
            >
              <span className="cursor-help border-b border-dotted border-sage-400/50 dark:border-moss-muted">(?)</span>
            </HoverTip>
          </span>
          <NumericAmountInput
            min={0}
            className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-lg text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={state.emergencyFund}
            onValueChange={onFund}
          />
        </label>
      </div>

      <div className="mt-8 border-t border-sage-200/80 pt-6 dark:border-moss-border">
        <h4 className="mb-3 font-display text-base font-bold text-sage-900 dark:text-moss-fg">Savings goals</h4>
        <SetupSavingsGoalsRows
          rows={goals}
          variant={mode === 'manage' ? 'manage' : 'setup'}
          onChange={(rows) => {
            const next = sanitizeSavingsGoals(rows);
            onSavingsGoals(next);
            syncLegacyTarget(next);
          }}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[25, 50, 100].map((n) => (
          <button
            key={n}
            type="button"
            className="btn-primary btn-primary-sm font-medium"
            onClick={() => onFund(state.emergencyFund + n)}
          >
            +{formatMoney(n)}
          </button>
        ))}
      </div>
    </Card>
  );
}
