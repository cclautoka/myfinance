import { useMemo } from 'react';
import type { DebtKind, FinanceState } from '../types/finance';
import { debtBalancesPanelTip } from '../copy/tooltips';
import { effectiveDebtBalance } from '../utils/calculations';
import { estimatedMonthlyInterestFromApr } from '../utils/debtInterest';
import { formatMoney } from '../utils/format';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';

const KIND_LABEL: Record<DebtKind, string> = {
  card: 'Credit card',
  installment: 'Installment / HP',
  loan: 'Loan',
  personal: 'Personal',
};

const KIND_ORDER: DebtKind[] = ['card', 'installment', 'loan', 'personal'];

const kindRank = (k: DebtKind): number => {
  const i = KIND_ORDER.indexOf(k);
  return i === -1 ? 99 : i;
};

export function DebtBalancesPanel({ state }: { state: FinanceState }) {
  const rows = useMemo(() => {
    const ref = new Date();
    const sorted = [...state.debts].sort(
      (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name),
    );
    return sorted.map((d) => {
      const bal = effectiveDebtBalance(d, ref);
      const apr = d.annualInterestApr ?? 0;
      const estInt = estimatedMonthlyInterestFromApr(bal, apr);
      return { debt: d, balance: bal, apr, estInt };
    });
  }, [state.debts]);

  const totals = useMemo(() => {
    let balance = 0;
    let payment = 0;
    let interest = 0;
    for (const r of rows) {
      balance += r.balance;
      payment += r.debt.monthlyPayment;
      interest += r.estInt;
    }
    return { balance, payment, interest };
  }, [rows]);

  return (
    <div id="debt-balances">
      <HoverTip content={debtBalancesPanelTip()}>
        <div>
          <Card
            title={panels.debtBalances.title}
            subtitle={panels.debtBalances.subtitle}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Account</th>
                    <th className="pb-2 pr-3 font-medium text-right">Owed (approx.)</th>
                    <th className="pb-2 pr-3 font-medium text-right">Min pay / mo</th>
                    <th className="pb-2 font-medium text-right">~Interest / mo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ debt: d, balance, apr, estInt }) => (
                    <tr key={d.id} className="border-t border-sage-200/80 dark:border-moss-border">
                      <td className="py-2.5 pr-3 text-xs text-sage-600 dark:text-moss-muted">
                        {KIND_LABEL[d.kind]}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-sage-900 dark:text-moss-fg">{d.name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-sage-900 dark:text-moss-fg">
                        {formatMoney(balance)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-sage-700 dark:text-moss-subtle">
                        {formatMoney(d.monthlyPayment)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-sage-700 dark:text-moss-subtle">
                        {apr > 0 ? formatMoney(estInt) : '—'}
                        {apr > 0 && (
                          <span className="ml-1 text-[0.65rem] font-normal text-sage-500 dark:text-moss-muted">
                            @ {apr}% p.a.
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-sage-300/80 font-medium dark:border-moss-border">
                    <td className="py-3 pr-3 text-sage-900 dark:text-moss-fg" colSpan={2}>
                      Totals
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-sage-900 dark:text-moss-fg">
                      {formatMoney(totals.balance)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-sage-800 dark:text-moss-tip">
                      {formatMoney(totals.payment)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-sage-800 dark:text-moss-tip">
                      {totals.interest > 0 ? formatMoney(totals.interest) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
              <strong className="text-sage-800 dark:text-moss-subtle">HP / car with blank balance</strong> uses payment × months
              left until the end date — same rule as the dashboard debt total. Update the balance column whenever you open a
              statement so cards stay honest; the app will not grow balances for you.
            </p>
          </Card>
        </div>
      </HoverTip>
    </div>
  );
}
