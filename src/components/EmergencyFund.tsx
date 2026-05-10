import type { FinanceState } from '../types/finance';
import { emergencySectionTip, ringFirst1kTip, ringThreeMonthTip } from '../copy/tooltips';
import { allocationBreakdown } from '../utils/allocation';
import { formatMoney } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { ProgressRing } from './ui/ProgressRing';
import { NumericAmountInput } from './ui/NumericInputs';

export function EmergencyFund({
  state,
  onFund,
  onTarget,
}: {
  state: FinanceState;
  onFund: (n: number) => void;
  onTarget: (n: number) => void;
}) {
  const br = allocationBreakdown(state);
  const monthlyFloor = Math.max(1, br.essentials + br.debt);
  const suggested3 = monthlyFloor * 3;

  const k1 = Math.min(1, state.emergencyFund / 1000);
  const k3 = Math.min(1, state.emergencyFund / Math.max(state.threeMonthFundTarget, 1));

  return (
    <Card
      title="Backup (emergency) account"
      subtitle="Type whatever is really sitting in your joint saver — the app never reads the bank."
    >
      <div className="mb-6 rounded-xl border-2 border-sage-300/60 bg-sage-50 px-4 py-3 text-sm font-medium leading-snug text-sage-900 dark:border-moss-border dark:bg-moss-surface/90 dark:text-moss-subtle">
        <p>
          Change the balance after every transfer or statement check. Quick +$25 / +$50 / +$100 buttons only bump what you typed.
        </p>
        <p className="mt-2">
          <span className="font-bold dark:text-moss-fg">Two different ideas: </span>
          the saved <strong>Savings %</strong> × planned pay is your goal lane from income; this box is the <em>cash that is already in the account</em>.
        </p>
      </div>

      <div className="mb-6 rounded-xl border-2 border-dashed border-sage-400/50 bg-white/80 px-4 py-3 text-xs font-semibold leading-snug text-sage-800 dark:border-moss-border dark:bg-moss-bg/50 dark:text-moss-subtle">
        <p className="font-bold text-sage-900 dark:text-moss-fg">Other savings goals?</p>
        <p className="mt-2">
          Add them as normal lines under recurring bills (holiday fund, school fees, etc.). This box is only for backup / emergency cash on hand.
        </p>
      </div>
      <HoverTip content={emergencySectionTip()}>
        <p className="mb-6 cursor-default rounded-xl border-2 border-dashed border-sage-400/70 px-3 py-2 text-xs font-semibold text-sage-700 dark:border-moss-border dark:text-moss-muted">
          Hover for planned savings lane vs this balance.
        </p>
      </HoverTip>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-around">
        <ProgressRing value={k1} label="First $1,000" sublabel="A breathing milestone" tip={ringFirst1kTip()} />
        <ProgressRing
          value={k3}
          label="3‑month cushion (your goal)"
          sublabel={`Target ${formatMoney(state.threeMonthFundTarget)}`}
          tip={ringThreeMonthTip(state.threeMonthFundTarget, suggested3)}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-sage-700 dark:text-moss-subtle">
            Balance in your emergency / joint savings (you type){' '}
            <HoverTip
              content={
                <>
                  Whatever is in your real pot today — e.g. Westpac joint saver. Update after each transfer or when you check
                  internet banking. Rings only know this number, not your bank.
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
        <label className="block text-sm">
          <span className="font-medium text-sage-700 dark:text-moss-subtle">
            3‑month savings target (editable){' '}
            <HoverTip content={<>Same dollar amount as “goal” on the 3‑month ring. Template suggested ~{formatMoney(suggested3)} from essentials + debt; make it honestly yours.</>}>
              <span className="cursor-help border-b border-dotted border-sage-400/50 dark:border-moss-muted">(?)</span>
            </HoverTip>
          </span>
          <NumericAmountInput
            min={0}
            className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-lg text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={state.threeMonthFundTarget}
            onValueChange={onTarget}
          />
        </label>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-sage-700 dark:text-moss-muted">
        Suggested 3‑month target from your plan&apos;s essentials + debt (just a starting guess):{' '}
        <strong>{formatMoney(suggested3)}</strong> — edit the target above until it matches how you count “three months.”
      </p>

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
