import { useMemo, useState } from 'react';
import type { DebtAccount, FinanceState } from '../types/finance';
import { debtBalancesPanelTip } from '../copy/tooltips';
import { effectiveDebtBalance } from '../utils/calculations';
import { cardAvailableFromOwed } from '../utils/cardCredit';
import { debtPaymentHistory } from '../utils/paymentHistory';
import { estimatedMonthlyInterestFromApr } from '../utils/debtInterest';
import { formatMoney } from '../utils/format';
import { panels } from '../copy/panels';
import { Card } from './ui/Card';
import { HoverTip } from './ui/HoverTip';
import { DebtPaymentHistoryModal } from './DebtPaymentHistoryModal';
import { UpdateCardBalanceModal } from './UpdateCardBalanceModal';
import { UpdateDebtBalanceModal } from './UpdateDebtBalanceModal';

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

type DebtRow = {
  debt: DebtAccount;
  balance: number;
  apr: number;
  estInt: number;
  utilPct: number | null;
  available: number | null;
  limit: number;
};

function buildDebtRows(state: FinanceState): DebtRow[] {
  const ref = new Date();
  const sorted = [...state.debts].sort(
    (a, b) => kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name),
  );
  return sorted.map((d) => {
    const bal = effectiveDebtBalance(d, ref, state);
    const apr = d.annualInterestApr ?? 0;
    const estInt = estimatedMonthlyInterestFromApr(bal, apr);
    const limit = d.creditLimit ?? 0;
    const available = cardAvailableFromOwed(d);
    const utilPct = limit > 0 && bal > 0 ? Math.min(100, (bal / limit) * 100) : null;
    return { debt: d, balance: bal, apr, estInt, utilPct, available, limit };
  });
}

function rowIsClickable(d: DebtAccount): boolean {
  if (d.kind === 'card' || d.kind === 'loan') return true;
  return d.monthlyPayment > 0;
}

function rowClickHint(d: DebtAccount): string | null {
  if (d.kind === 'card' || d.kind === 'loan' || d.monthlyPayment <= 0) {
    return `Tap row to ${panels.debtUpdateBalance.toLowerCase()}`;
  }
  return 'Tap row to mark next payment';
}

export function DebtBalancesPanel({
  state,
  onUpdateDebtBalance,
  onUpdateDebtBalanceDirect,
  onMarkNextDebtPayment,
}: {
  state: FinanceState;
  onUpdateDebtBalance?: (debtId: string, availableCredit: number, creditLimit?: number) => void;
  onUpdateDebtBalanceDirect?: (debtId: string, balance: number, options?: { markPaidOff?: boolean }) => void;
  onMarkNextDebtPayment?: (debtId: string) => void;
}) {
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const [historyDebtId, setHistoryDebtId] = useState<string | null>(null);

  const allRows = useMemo(() => buildDebtRows(state), [state]);
  const activeRows = useMemo(() => allRows.filter((r) => r.balance > 0), [allRows]);
  const paidOffRows = useMemo(() => allRows.filter((r) => r.balance <= 0), [allRows]);

  const editCardDebt = useMemo(
    () => (editCardId ? state.debts.find((d) => d.id === editCardId) ?? null : null),
    [editCardId, state.debts],
  );
  const editDirectDebt = useMemo(() => {
    if (!editDebtId) return null;
    const debt = state.debts.find((d) => d.id === editDebtId) ?? null;
    if (!debt) return null;
    const row = allRows.find((r) => r.debt.id === editDebtId);
    return { debt, currentBalance: row?.balance ?? 0 };
  }, [editDebtId, state.debts, allRows]);

  const historyDebt = useMemo(
    () => (historyDebtId ? state.debts.find((d) => d.id === historyDebtId) ?? null : null),
    [historyDebtId, state.debts],
  );

  const totals = useMemo(() => {
    let balance = 0;
    let payment = 0;
    let interest = 0;
    for (const r of activeRows) {
      balance += r.balance;
      payment += r.debt.monthlyPayment;
      interest += r.estInt;
    }
    return { balance, payment, interest };
  }, [activeRows]);

  const openUpdate = (d: DebtAccount) => {
    if (d.kind === 'card') setEditCardId(d.id);
    else setEditDebtId(d.id);
  };

  const handleRowClick = (d: DebtAccount) => {
    if (d.kind === 'card' || d.kind === 'loan') {
      openUpdate(d);
      return;
    }
    if (d.monthlyPayment > 0) onMarkNextDebtPayment?.(d.id);
    else openUpdate(d);
  };

  const renderDebtRow = (r: DebtRow, paidOff = false) => {
    const { debt: d, balance, apr, estInt, utilPct, available, limit } = r;
    const clickable = !paidOff && rowIsClickable(d);
    const paymentCount = paidOff ? debtPaymentHistory(state, d).length : 0;

    return (
      <tr
        key={d.id}
        className={`border-t border-sage-200/80 dark:border-moss-border ${
          clickable ? 'cursor-pointer hover:bg-sage-50/80 dark:hover:bg-moss-bg/40' : ''
        } ${paidOff ? 'opacity-90' : ''}`}
        onClick={clickable ? () => handleRowClick(d) : paidOff ? () => setHistoryDebtId(d.id) : undefined}
        title={
          clickable
            ? d.kind === 'card' || d.kind === 'loan' || d.monthlyPayment <= 0
              ? panels.debtUpdateBalance
              : 'Mark next installment paid'
            : paidOff
              ? 'View payment history'
              : undefined
        }
      >
        <td className="py-2.5 pr-3 text-xs text-sage-600 dark:text-moss-muted">{KIND_LABEL[d.kind]}</td>
        <td className="py-2.5 pr-3 font-medium text-sage-900 dark:text-moss-fg">
          {d.name}
          {paidOff ? (
            <span className="mt-0.5 block text-[11px] font-normal text-emerald-800 dark:text-emerald-300/90">
              Paid off · {paymentCount} payment{paymentCount === 1 ? '' : 's'} logged
            </span>
          ) : null}
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
          {d.kind === 'loan' && d.balanceUpdatedAt ? (
            <span className="mt-0.5 block text-[10px] font-normal text-sage-500 dark:text-moss-muted">
              checked {d.balanceUpdatedAt}
            </span>
          ) : null}
          {!paidOff && rowClickHint(d) ? (
            <span className="mt-0.5 block text-[10px] font-normal text-teal-800/90 dark:text-teal-200/80">
              {rowClickHint(d)}
            </span>
          ) : null}
          {utilPct !== null ? (
            <span className="mt-0.5 block text-[10px] font-normal text-rose-700 dark:text-rose-300/80">
              {Math.round(utilPct)}% used · limit {formatMoney(limit)}
            </span>
          ) : null}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums text-sage-900 dark:text-moss-fg">
          {paidOff ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
              Paid off
            </span>
          ) : (
            formatMoney(balance)
          )}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums text-sage-700 dark:text-moss-subtle">
          {formatMoney(d.monthlyPayment)}
        </td>
        <td className="py-2.5 pr-3 text-right tabular-nums text-sage-700 dark:text-moss-subtle">
          {apr > 0 ? formatMoney(estInt) : '—'}
          {apr > 0 && (
            <span className="ml-1 text-[0.65rem] font-normal text-sage-500 dark:text-moss-muted">@ {apr}% p.a.</span>
          )}
        </td>
        <td className="py-2.5 text-right">
          {!paidOff &&
          ((d.kind === 'card' && onUpdateDebtBalance) || (d.kind !== 'card' && onUpdateDebtBalanceDirect)) ? (
            <button
              type="button"
              className="btn-secondary btn-secondary-sm whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                openUpdate(d);
              }}
            >
              {panels.debtUpdateBalance}
            </button>
          ) : paidOff ? (
            <button
              type="button"
              className="btn-secondary btn-secondary-sm whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                setHistoryDebtId(d.id);
              }}
            >
              History
            </button>
          ) : null}
        </td>
      </tr>
    );
  };

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
                  {activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-sage-600 dark:text-moss-muted">
                        Nothing left on the board — see paid-off achievements below.
                      </td>
                    </tr>
                  ) : (
                    activeRows.map((r) => renderDebtRow(r))
                  )}
                </tbody>
                {activeRows.length > 0 ? (
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
                ) : null}
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-sage-600 dark:text-moss-muted">
              <strong className="text-sage-800 dark:text-moss-subtle">HP:</strong> tap a row to mark the next installment
              paid (balance drops automatically). Everything else: use{' '}
              <strong className="text-sage-800 dark:text-moss-subtle">{panels.debtUpdateBalance}</strong> or tap the row
              — last payment moves the debt to achievements automatically.
            </p>
          </Card>

          {paidOffRows.length > 0 ? (
            <Card
              className="mt-6"
              accent="emerald"
              title={panels.debtAchievements.title}
              subtitle={panels.debtAchievements.subtitle}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-sage-600 dark:text-moss-muted">
                      <th className="pb-2 pr-3 font-medium">Type</th>
                      <th className="pb-2 pr-3 font-medium">Account</th>
                      <th className="pb-2 pr-3 font-medium text-right">Status</th>
                      <th className="pb-2 pr-3 font-medium text-right">Was / mo</th>
                      <th className="pb-2 pr-3 font-medium text-right"> </th>
                      <th className="pb-2 font-medium text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>{paidOffRows.map((r) => renderDebtRow(r, true))}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-sage-600 dark:text-moss-muted">
                Tap a paid-off row or History to see each installment — who paid (Primary or Partner) and when.
              </p>
            </Card>
          ) : null}
        </div>
      </HoverTip>

      <UpdateCardBalanceModal
        debt={editCardDebt}
        open={editCardId !== null}
        onClose={() => setEditCardId(null)}
        onSave={(id, avail, limit) => onUpdateDebtBalance?.(id, avail, limit)}
      />
      <UpdateDebtBalanceModal
        debt={editDirectDebt?.debt ?? null}
        currentBalance={editDirectDebt?.currentBalance ?? 0}
        open={editDebtId !== null}
        onClose={() => setEditDebtId(null)}
        onSave={(id, bal, opts) => onUpdateDebtBalanceDirect?.(id, bal, opts)}
      />
      <DebtPaymentHistoryModal
        debt={historyDebt}
        state={state}
        open={historyDebtId !== null}
        onClose={() => setHistoryDebtId(null)}
      />
    </div>
  );
}
