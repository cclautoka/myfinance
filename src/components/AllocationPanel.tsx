import { useMemo } from 'react';
import type { FinanceState } from '../types/finance';
import { allocationSectionTip } from '../copy/tooltips';
import { WEEKS_IN_MONTHLY_PLAN } from '../utils/calculations';
import { allocationBreakdown } from '../utils/allocation';
import { formatMoney } from '../utils/format';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { NumericAmountInput } from './ui/NumericInputs';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const pieFill: Record<string, string> = {
  essentials: '#8ba396',
  groceries: '#7d8fa3',
  debt: '#9aa38c',
  savings: '#b5a889',
  personal: '#b8919a',
  remainder: '#c5cac2',
};

function diffNote(
  label: string,
  fromTable: number,
  fromSlider: number,
): string | null {
  if (Math.abs(fromTable - fromSlider) < 8) return null;
  return `${label}: table says ${formatMoney(fromTable)} but legacy split % would imply ~${formatMoney(fromSlider)} — only the table amount is counted here.`;
}

export function AllocationPanel({
  state,
  onPatch,
}: {
  state: FinanceState;
  onPatch: (p: Partial<FinanceState>) => void;
}) {
  const br = allocationBreakdown(state);
  const foodLine = state.essentials.find((e) => e.id === 'food');
  const groceriesExplained =
    foodLine && foodLine.cadence === 'week'
      ? `${formatMoney(foodLine.amount)}/week × ${WEEKS_IN_MONTHLY_PLAN} weeks = ${formatMoney(br.groceries)}/month`
      : foodLine
        ? `${formatMoney(foodLine.amount)}/month`
        : 'Add a “Groceries” row in Household data to track this.';

  const pieData = useMemo(() => {
    const rows: { name: string; value: number; key: string }[] = [
      { name: 'Essentials', value: Math.max(0, br.essentials), key: 'essentials' },
      { name: 'Groceries', value: Math.max(0, br.groceries), key: 'groceries' },
      { name: 'Debt', value: Math.max(0, br.debt), key: 'debt' },
      { name: 'Savings', value: Math.max(0, br.savings), key: 'savings' },
      { name: 'Personal', value: Math.max(0, br.personal), key: 'personal' },
    ];
    if (br.remainder > 0.5) {
      rows.push({ name: 'Unallocated', value: br.remainder, key: 'remainder' });
    }
    return rows.filter((r) => r.value > 0.005);
  }, [br]);

  const pieTotal = useMemo(() => pieData.reduce((s, r) => s + r.value, 0), [pieData]);

  const hints = [
    diffNote('Essentials', br.essentials, br.sliderDollars.essentials),
    diffNote('Groceries', br.groceries, br.sliderDollars.groceries),
    diffNote('Debt', br.debt, br.sliderDollars.debt),
  ].filter(Boolean) as string[];

  const inc = Math.max(1e-6, br.income);

  const setSavings = (n: number) => onPatch({ plannedSavingsMonthly: Math.max(0, Number.isFinite(n) ? n : 0) });
  const setPersonal = (n: number) => onPatch({ plannedPersonalMonthly: Math.max(0, Number.isFinite(n) ? n : 0) });

  return (
    <Card
      title={panels.allocation.title}
      subtitle={panels.allocation.subtitle}
    >
      <HoverTip content={allocationSectionTip()}>
        <p className="mb-6 cursor-default rounded-xl border border-dashed border-sage-400/70 px-3 py-2 text-xs font-semibold leading-relaxed text-sage-700 dark:border-moss-border dark:text-moss-muted">
          Hover for how essentials / debt slices still follow Household rows.
        </p>
      </HoverTip>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
          Planned savings (this month)
          <NumericAmountInput
            min={0}
            className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-lg tabular-nums text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={state.plannedSavingsMonthly}
            onValueChange={setSavings}
          />
          <span className="mt-1.5 block text-[11px] font-normal text-sage-600 dark:text-moss-muted">
            Dollars you intend to set aside after covering essentials-style bills — drives the Savings wedge and leftover room.
          </span>
        </label>
        <label className="block text-sm font-medium text-sage-800 dark:text-moss-fg">
          Planned personal / fun envelope
          <NumericAmountInput
            min={0}
            className="mt-1 w-full rounded-xl border border-sage-300 bg-white px-3 py-2 text-lg tabular-nums text-sage-900 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
            value={state.plannedPersonalMonthly}
            onValueChange={setPersonal}
          />
          <span className="mt-1.5 block text-[11px] font-normal text-sage-600 dark:text-moss-muted">
            Discretionary pot in dollars — aligns with wallets under Plan when you compare totals.
          </span>
        </label>
      </div>

      <div className="mb-6 rounded-xl border-2 border-teal-700/25 bg-teal-50/60 p-4 text-sm font-medium leading-snug text-sage-900 dark:border-teal-900/35 dark:bg-teal-950/30 dark:text-moss-subtle">
        <p className="font-bold dark:text-moss-fg">Quick rules</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px]">
          <li>
            <strong>Essentials · food · loans</strong> wedges use Household dollar totals (same as Dashboard).
          </li>
          <li>
            <strong>Savings</strong> and <strong>personal</strong> wedges use the two fields above — pie labels show each as a %
            of pay and % of all wedges drawn.
          </li>
          <li>
            <strong>Groceries</strong> follows the groceries row ({groceriesExplained}).
          </li>
        </ul>
      </div>

      {br.remainder < -1 && (
        <div className="mb-6 rounded-xl border border-amber-300/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
          <strong className="font-semibold">Plan is tighter than steady income.</strong> Bills + savings + personal add up to{' '}
          {formatMoney(Math.abs(br.remainder))} more than husband+wife planned pay — lighten a Household row or lower the savings /
          personal dollars if needed.
        </div>
      )}

      {hints.length > 0 && (
        <ul className="mb-6 list-disc space-y-1 rounded-lg border border-sage-200/80 bg-sage-50/70 py-3 pl-8 pr-3 text-xs text-sage-800 dark:border-moss-border dark:bg-moss-bg dark:text-moss-muted">
          {hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <div className="mx-auto flex max-w-xl flex-col items-center gap-8">
        <div className="relative h-72 w-full max-w-[20rem] min-w-0">
          {pieData.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-sage-600 dark:text-moss-muted">
              Add household income to see a dollar-based plan split.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={pieData}
                    innerRadius={55}
                    outerRadius={105}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={pieFill[entry.key] ?? '#94a3a0'} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      const val = Number(p.value);
                      const pctPay = br.income > 0 ? (val / br.income) * 100 : 0;
                      const pctDonut = pieTotal > 0 ? (val / pieTotal) * 100 : 0;
                      return (
                        <div className="rounded-lg border border-sage-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-moss-border dark:bg-moss-elevated">
                          <p className="font-semibold text-sage-900 dark:text-moss-fg">{p.name}</p>
                          <p className="text-sage-800 dark:text-moss-subtle">{formatMoney(val)}</p>
                          <p className="mt-1 text-[11px] text-sage-500 dark:text-moss-muted">
                            {pctPay.toFixed(1)}% of planned pay · {pctDonut.toFixed(1)}% of this donut
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-1">
                <div className="max-w-[6.5rem] text-center text-[11px] leading-tight text-sage-700 dark:text-moss-subtle">
                  <p className="font-semibold uppercase tracking-wide text-[10px] text-sage-500 dark:text-moss-muted">Planned</p>
                  <p className="font-display text-sm font-semibold text-sage-900 dark:text-moss-fg">{formatMoney(br.income)}</p>
                  <p className="text-[10px] text-sage-500 dark:text-moss-muted">combined monthly pay</p>
                </div>
              </div>
            </>
          )}
        </div>

        {pieData.length > 0 && (
          <>
            <ul className="w-full min-w-0 space-y-2 rounded-xl border border-sage-200/80 bg-sage-50/50 p-4 dark:border-moss-border dark:bg-moss-bg/50">
              {pieData.map((row) => {
                const pctPay = (row.value / inc) * 100;
                const pctDonut = pieTotal > 0 ? (row.value / pieTotal) * 100 : 0;
                return (
                  <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10 dark:ring-white/15"
                        style={{ backgroundColor: pieFill[row.key] ?? '#94a3a0' }}
                      />
                      <span className="font-medium text-sage-900 dark:text-moss-fg">{row.name}</span>
                    </span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-sage-800 dark:text-moss-subtle">
                      <span className="block sm:inline">{formatMoney(row.value)}</span>
                      <span className="mt-0.5 block text-xs font-medium text-sage-600 dark:text-moss-muted sm:ml-2 sm:inline">
                        {pctPay.toFixed(1)}% of pay · {pctDonut.toFixed(1)}% of wedges
                      </span>
                    </span>
                  </li>
                );
              })}
              {br.remainder <= 0.5 && (
                <li className="border-t border-sage-200/80 pt-2 text-[11px] text-sage-600 dark:border-moss-border dark:text-moss-muted">
                  No separate unallocated wedge — leftovers under ~50¢ are rounded away.
                </li>
              )}
            </ul>
            <p className="text-center text-[11px] leading-relaxed text-sage-600 dark:text-moss-muted">
              Wedge sizes follow <strong className="text-sage-800 dark:text-moss-subtle">dollars you entered</strong> (tables +
              savings + personal). Labels are not tied to legacy % sliders unless those % happen to match.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
