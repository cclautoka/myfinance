import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { snowballTip } from '../copy/tooltips';
import { formatMoney } from '../utils/format';
import { snowballOrder } from '../utils/snowball';
import { HoverTip } from './ui/HoverTip';
import { Card } from './ui/Card';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function DebtSnowball({ state, compact }: { state: FinanceState; compact?: boolean }) {
  const { ordered, maxEffectiveBalance } = useMemo(() => {
    const o = snowballOrder(state.debts);
    const maxEff = o.reduce((m, r) => Math.max(m, r.effectiveBalance), 0);
    return { ordered: o, maxEffectiveBalance: maxEff };
  }, [state.debts]);

  const chartData = ordered.map((r) => ({
    /** Full name — short labels duplicated keys (e.g. three “Personal — …” rows) and broke Recharts tooltips. */
    name: r.debt.name,
    balance: Math.round(r.effectiveBalance),
    payment: r.debt.monthlyPayment,
    order: r.snowballOrder,
  }));

  return (
    <HoverTip content={snowballTip()}>
      <div>
        <Card
          accent="violet"
          title={compact ? 'Debt payoff snapshot' : 'Payoff order cheer chart'}
          subtitle={
            compact
              ? 'Smallest balance first (same as Plan). Chart bar length = remaining; grey strip under each row uses the same scale (widest = largest balance here).'
              : 'Smallest balances first — morale only. Chart and row strips scale to the largest remaining balance on this list; hover the card for detail.'
          }
        >
          <div className={`mb-6 w-full min-w-0 ${compact ? 'h-52' : 'h-64'}`}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              className="[&_.recharts-cartesian-axis-tick_text]:fill-sage-600 dark:[&_.recharts-cartesian-axis-tick_text]:fill-moss-muted"
            >
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={compact ? 128 : 140}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatMoney(Number(value ?? 0)),
                    name === 'balance' ? 'Remaining (est.)' : String(name),
                  ]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="balance" fill="#647064" radius={[0, 8, 8, 0]} className="opacity-90 dark:opacity-85" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-3">
            {ordered.map((r) => {
              const bal = r.effectiveBalance;
              /** Same visual language as the chart: width ∝ balance vs max on this list (old “paydown” formula hit 50% whenever min payment was tiny). */
              const stripPct =
                bal <= 0 || maxEffectiveBalance <= 0
                  ? 0
                  : Math.min(100, (bal / maxEffectiveBalance) * 100);
              return (
                <li
                  key={r.debt.id}
                  className="rounded-xl border border-sage-200/70 bg-white/60 p-4 dark:border-moss-border dark:bg-moss-surface"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sage-900 dark:text-moss-fg">{r.debt.name}</p>
                      <p className="text-xs text-sage-600 dark:text-moss-muted">
                        {r.snowballOrder > 0 ? `Snowball #${r.snowballOrder}` : 'Clear or informational'}
                        {r.debt.autoDeduction ? ' · Auto' : ''}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-sage-900 dark:text-moss-fg">{formatMoney(bal)} remaining (est.)</p>
                      <p className="text-sage-600 dark:text-moss-muted">Min payment {formatMoney(r.debt.monthlyPayment)}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-sage-200 dark:bg-moss-bg">
                    <div
                      className="h-full rounded-full bg-sage-600 transition-all duration-700 dark:bg-moss-primary dark:opacity-90"
                      style={{ width: `${stripPct}%` }}
                      title={
                        maxEffectiveBalance > 0
                          ? `${Math.round(stripPct)}% of largest debt on this list (${formatMoney(maxEffectiveBalance)})`
                          : undefined
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </HoverTip>
  );
}
