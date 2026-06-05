import { useMemo, useState } from 'react';
import type { FinanceState } from '../types/finance';
import { debtBalancesPanelTip } from '../copy/tooltips';
import { effectiveDebtBalance } from '../utils/calculations';
import { cardAvailableFromOwed } from '../utils/cardCredit';
import { estimatedMonthlyInterestFromApr } from '../utils/debtInterest';
import { formatMoney } from '../utils/format';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { UpdateCardBalanceModal } from './UpdateCardBalanceModal';

const KIND_LABEL: Record<FinanceState['debts'][0]['kind'], string> = {
  card: 'Credit card',
  installment: 'Installment / HP',
  loan: 'Loan',
  personal: 'Personal',
};

const KIND_ORDER: FinanceState['debts'][0]['kind'][] = ['card', 'installment', 'loan', 'personal'];

const kindRank = (k: FinanceState['debts'][0]['kind']): number => {
  const i = KIND_ORDER.indexOf(k);
  return i === -1 ? 99 : i;
};

export function DebtBalancesPanel({
  state,
  onUpdateDebtBalance,
}: {
  state: FinanceState;
  onUpdateDebtBalance?: (debtId: string, availableCredit: number, creditLimit?: number) => void;
}) {
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const editDebt = useMemo(
    () => (editCardId ? state.debts.find((d) => d.id === editCardId) ?? null : null),
    [editCardId, state.debts],
  );

  const rows = useMemo(() => {
    const ref = new Date();
    const sorted = [...state.debts].sort(
      (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name),
    );
    return sorted.map((d) => {
      const bal = effectiveDebtBalance(d, ref);
      const apr = d.annualInterestApr ?? 0;
      const estInt = estimatedMonthlyInterestFromApr(bal, apr);
      const limit = d.creditLimit ?? 0;
      const available = cardAvailableFromOwed(d);
      const utilPct = limit > 0 && bal > 0 ? Math.min(100, (bal / limit) * 100) : null;
      return { debt: d, balance: bal, apr, estInt, utilPct, available, limit };
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
          <Card title={panels.debtBalances.title} subtitle={panels.debtBalances.subtitle}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Account</th>
                    <th className="pb-2 pr-3 font-medium text-right">Owed (approx.)</th>
                    <th className="pb-2 pr-3 font-medium text-right">Min pay / mo</th>
                    <th className="pb-2 pr-3 font-medium text-right">~Interest / mo</th>
                    <th className="pb-2 font-medium text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ debt: d, balance, apr, estInt, utilPct, available, limit }) => (
                    <tr key={d.id} className="border-t border-sage-200/80 dark:border-moss-border">
                      <td className="py-2.5 pr-3 text-xs text-sage-600 dark:text-moss-muted">
                        {KIND_LABEL[d.kind]}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-sage-900 dark:text-moss-fg">
                        {d.name}
                        {d.kind === 'card' && available !== null ? (
                          <span className="mt-0.5 block text-[11px] font-normal text-teal-800 dark:text-teal-200/90">
                            {formatMoney(available)} available
                          </span>
                        ) : null}
                        {d.kind === 'card' && d.balanceUpdatedAt ? (
                          <span className="mt-0.5 block text-[10px] font-normal text-sage-500 dark:text-moss-muted">
                            checked {d.balanceUpdatedAt}
                          </span>
                        ) : null}
                        {utilPct !== null ? (
                          <span className="mt-0.5 block text-[10px] font-normal text-rose-700 dark:text-rose-300/80">
                            {Math.round(utilPct)}% used · limit {formatMoney(limit)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-sage-900 dark:text-moss-fg">
                        {formatMoney(balance)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-sage-700 dark:text-moss-subtle">
                        {formatMoney(d.monthlyPayment)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-sage-700 dark:text-moss-subtle">
                        {apr > 0 ? formatMoney(estInt) : '—'}
                        {apr > 0 && (
                          <span className="ml-1 text-[0.65rem] font-normal text-sage-500 dark:text-moss-muted">
                            @ {apr}% p.a.
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {d.kind === 'card' && onUpdateDebtBalance ? (
                          <button
                            type="button"
                            className="btn-secondary btn-secondary-sm whitespace-nowrap"
                            onClick={() => setEditCardId(d.id)}
                          >
                            Update available
                          </button>
                        ) : null}
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
                    <td className="py-3 pr-3 text-right tabular-nums text-sage-800 dark:text-moss-tip">
                      {totals.interest > 0 ? formatMoney(totals.interest) : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
              <strong className="text-sage-800 dark:text-moss-subtle">HP / car with blank balance</strong> uses payment × months
              left until the end date. For cards, tap{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">Update available</strong> with the figure from your
              bank app (we derive owed from limit − available). Set credit limits in Household once.
            </p>
          </Card>
        </div>
      </HoverTip>
      <UpdateCardBalanceModal
        debt={editDebt}
        open={editCardId !== null}
        onClose={() => setEditCardId(null)}
        onSave={(id, avail, limit) => onUpdateDebtBalance?.(id, avail, limit)}
      />
    </div>
  );
}
