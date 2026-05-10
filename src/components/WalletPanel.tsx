import type { FinanceState } from '../types/finance';
import { walletsTip } from '../copy/tooltips';
import { allocationBreakdown } from '../utils/allocation';
import { formatMoney } from '../utils/format';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { NumericAmountInput } from './ui/NumericInputs';

function WalletBar({
  label,
  budget,
  spent,
  onBudget,
  onSpendDelta,
}: {
  label: string;
  budget: number;
  spent: number;
  onBudget: (n: number) => void;
  onSpendDelta: (delta: number) => void;
}) {
  const left = Math.max(0, budget - spent);
  const pct = budget <= 0 ? 0 : Math.min(1, spent / budget);
  return (
    <div className="rounded-xl border border-sage-200/70 bg-white/70 p-4 dark:border-moss-border dark:bg-moss-surface">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-sage-900 dark:text-moss-fg">{label}</p>
          <p className="text-xs font-semibold text-sage-600 dark:text-moss-muted">Discretionary</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-sage-800 dark:text-moss-tip">{formatMoney(left)} left</p>
          <p className="text-xs text-sage-500 dark:text-moss-muted">of {formatMoney(budget)} budget</p>
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-sage-200 dark:bg-moss-bg">
        <div
          className="h-full rounded-full bg-sage-500 transition-all duration-500 dark:bg-moss-primary dark:opacity-90"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-sage-600 dark:text-moss-muted">
          Monthly budget
          <NumericAmountInput
            min={0}
            className="w-24 rounded-lg border border-sage-300 bg-white px-2 py-1 text-sm dark:border-moss-border dark:bg-moss-elevated"
            value={budget}
            onValueChange={onBudget}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full bg-sage-200 px-3 py-1 text-xs font-medium text-sage-800 hover:bg-sage-300 dark:bg-moss-bg dark:text-moss-fg dark:hover:bg-moss-border"
            onClick={() => onSpendDelta(-10)}
          >
            −10 spent
          </button>
          <button
            type="button"
            className="rounded-full bg-sage-200 px-3 py-1 text-xs font-medium text-sage-800 hover:bg-sage-300 dark:bg-moss-bg dark:text-moss-fg dark:hover:bg-moss-border"
            onClick={() => onSpendDelta(10)}
          >
            +10 spent
          </button>
        </div>
      </div>
    </div>
  );
}

export function WalletPanel({
  state,
  onWallets,
}: {
  state: FinanceState;
  onWallets: (w: FinanceState['wallets']) => void;
}) {
  const w = state.wallets;
  const br = allocationBreakdown(state);
  const personalPool = br.personal;
  const sumWallets = w.husbandBudget + w.wifeBudget;
  const walletGap = sumWallets - personalPool;

  return (
    <HoverTip content={walletsTip()}>
      <div>
        <Card
          title="Fun money per person"
          subtitle="Split the Personal slice from the pie — his budget + hers, numbers you type yourself."
        >
          <div className="mb-4 rounded-xl border-2 border-sage-300/50 bg-sage-50 p-3 text-sm font-medium leading-snug text-sage-900 dark:border-moss-border dark:bg-moss-surface/90 dark:text-moss-subtle">
            <p>
              Pie <strong className="dark:text-moss-fg">Personal</strong> pays out <strong>{formatMoney(personalPool)}</strong> a month between you.
            </p>
            <p className="mt-2">
              Type his and her caps here (any split you like). Tiny +/− buttons help you remember spending — not synced to a bank feed.
            </p>
            {sumWallets > personalPool + 5 && (
              <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-100/90">
                Wallets total {formatMoney(sumWallets)} — about {formatMoney(walletGap)} above the Personal slice. Raise planned personal dollars in the monthly split or trim a wallet so the story matches.
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <WalletBar
              label="Husband wallet"
              budget={w.husbandBudget}
              spent={w.husbandSpent}
              onBudget={(husbandBudget) => onWallets({ ...w, husbandBudget })}
              onSpendDelta={(d) => onWallets({ ...w, husbandSpent: Math.max(0, w.husbandSpent + d) })}
            />
            <WalletBar
              label="Wife wallet"
              budget={w.wifeBudget}
              spent={w.wifeSpent}
              onBudget={(wifeBudget) => onWallets({ ...w, wifeBudget })}
              onSpendDelta={(d) => onWallets({ ...w, wifeSpent: Math.max(0, w.wifeSpent + d) })}
            />
          </div>
        </Card>
      </div>
    </HoverTip>
  );
}
