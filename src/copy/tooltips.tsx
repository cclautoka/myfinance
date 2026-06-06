import type { ReactNode } from 'react';
import { formatCalendarMonthHeading, HISTORY_TRACKING_STARTED_MONTH_KEY } from '../data/defaults';
import { formatMoney } from '../utils/format';

export function dashboardIncomeLoggedVsPlannedTip(planned: number, logged: number): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Planned monthly income</strong> is the husband and wife
      totals in Household data. <strong className="text-sage-900 dark:text-moss-tip">Deposits this month</strong> are
      only what you enter in the Paycheque log. They can be lower mid-month before every cheque arrives. That is
      normal. <strong className="text-sage-900 dark:text-moss-tip">Extra cash</strong> is for bonuses and gifts
      outside regular pay.
      {logged > 0 && (
        <>
          {' '}
          Right now: logged <strong>{formatMoney(logged)}</strong>, planned{' '}
          <strong>{formatMoney(planned)}</strong>.
        </>
      )}
    </>
  );
}

export function incomeLogTip(): ReactNode {
  return (
    <>
      Each row is a deposit date and amount. We total them for the calendar month and show that beside your plan
      from Household data. The current month lives on the Dashboard. Past months use the matching block under Past
      months. If you set pay rhythm and a usual amount per cheque, we estimate variable pay on each deposit. That
      is separate from Extra cash. Tag Joint for shared deposits. Husband and Wife drive the baseline math.
    </>
  );
}

export function dashboardIncomeTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Planned</strong> pay comes from husband and wife monthly
      fields in Household data. Put surprise income in <strong>Extra cash</strong>. Log real cheques in the{' '}
      <strong>Paycheque log</strong> to update Deposits this month on the snapshot.
    </>
  );
}

export function dashboardVariablePayTip(): ReactNode {
  return (
    <>
      We compare each logged husband or wife deposit to the usual cheque from Household data. The gap is an estimate
      of variable pay. It does not change allocation until you reflect it in Extra cash, savings, or bill amounts
      you enter yourself.
    </>
  );
}

export function dashboardEarnerSplitTip(): ReactNode {
  return (
    <>
      Uses dollar amounts from essentials, groceries, debts, savings, and personal. It splits that bucket in proportion
      to each spouse&apos;s planned salary. What is left per person matches the household unallocated remainder. This
      is a view only, not automatic bank logic.
    </>
  );
}

export function dashboardEmergencyTip(): ReactNode {
  return (
    <>
      This is the balance you say is in your real savings, for example a joint emergency account. The app never
      connects to your bank. When you move money in or out, update this number so the dashboard stays accurate.
    </>
  );
}

export function dashboardDebtTip(): ReactNode {
  return (
    <>
      Rough total still owed across cards, loans, and HP lines in Household data. Interest is never added
      automatically. Type balances from statements when you reconcile. Useful for direction, not a legal payoff
      quote.
    </>
  );
}

export function debtBalancesPanelTip(): ReactNode {
  return (
    <>
      Every row uses <strong className="text-sage-900 dark:text-moss-tip">Update balance</strong> — cards enter
      available credit; HP / loans enter what you still owe. Tap HP rows to mark the next payment; when nothing is left,
      the debt moves to achievements automatically.
    </>
  );
}

export function debtPayoffPathTip(): ReactNode {
  return (
    <>
      Projects total debt month by month using your Payment column, card APR, and HP end dates. The scenario slider adds
      hypothetical card spend so you can see the cost of continuing to swipe. Personal loans with no payment are
      excluded from the countdown.
    </>
  );
}

export function dashboardNextBillTip(): ReactNode {
  return (
    <>
      The next unchecked bill that is due today or later. Older unpaid rows stay on the Bill calendar until you mark
      them as paid. We show a backlog alert here when needed. Marking as paid updates this card without reloading.
    </>
  );
}

export function dashboardSafeSpendTip(): ReactNode {
  return (
    <>
      Approximate leftover per week after essentials, groceries, debt payments, and savings from your plan, with a
      gentle haircut if big bills bunch up soon. A rough estimate only, not permission to spend or a limit.
    </>
  );
}

export function dashboardBillsTickedTip(): ReactNode {
  return (
    <>
      How many bill rows with a due date this month you marked as paid. Weekly groceries are one row per week.
      Marking one Saturday does not mark the whole month. Debts usually use one mark per calendar month.
    </>
  );
}

export function dashboardDebtFreeMonthsTip(): ReactNode {
  return (
    <>
      Simulated month-by-month payoff from your current balances, capped payments, and snowball redirect when a debt
      clears. Personal loans without a payment are excluded from the countdown (still in total debt). Mark HP payments
      and update card balances for an honest estimate.
    </>
  );
}

export function dashboardDebtFreeMonthsTrendTip(
  kind: 'unknown' | 'worse' | 'better' | 'unchanged',
  delta: number | null,
  priorMonths: number | null,
  currentMonths: number | null,
): ReactNode {
  if (kind === 'unknown') {
    return (
      <>
        <strong className="text-sage-900 dark:text-moss-tip">No trend yet</strong> — we compare to when you opened{' '}
        this month. After month-opening, green ↓ means fewer months to debt-free; red ↑ means the path got longer.
      </>
    );
  }
  if (kind === 'worse' && delta !== null && priorMonths !== null && currentMonths !== null) {
    return (
      <>
        <strong className="text-rose-800 dark:text-rose-200">Path lengthened</strong> — up {delta} mo since you opened
        this month ({priorMonths} → {currentMonths} mo). Often card use or stale balances. Update balance for an honest
        read.
      </>
    );
  }
  if (kind === 'better' && delta !== null && priorMonths !== null && currentMonths !== null) {
    return (
      <>
        <strong className="text-emerald-800 dark:text-emerald-200">Path shortened</strong> — down {Math.abs(delta)} mo
        since you opened this month ({priorMonths} → {currentMonths} mo). Keep it up.
      </>
    );
  }
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Unchanged</strong> — same estimated months as when you opened
      this month ({priorMonths ?? currentMonths ?? '—'} mo).
    </>
  );
}

export function dashboardSavingsSliderTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Intent:</strong> planned monthly savings dollars from
      Plan and bills. <strong className="text-sage-900 dark:text-moss-tip">Achieved:</strong> the typed emergency
      balance (same as the Emergency fund metric and Rainy-day savings under Plan).
    </>
  );
}

export function dashboardPlannedVsActualExpensesTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Planned</strong> sums Household and Plan: essentials,
      groceries, debt payments, plus planned savings and personal.{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Actual</strong> counts bills due this month that you
      marked as paid (using actual paid when entered), plus unexpected expenses dated this month. Unmarked bills
      do not count. Not a bank feed.
    </>
  );
}

export function dashboardLeftFromDepositsTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Left from deposits</strong> is pay logged this month minus
      bills marked as paid that are due on or before today.{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Carry-over</strong> from last month is spent first — only
      what&apos;s left hits your deposits. Savings goal balances are not subtracted here.
    </>
  );
}

export function ringFirst1kTip(): ReactNode {
  return (
    <>
      A starter cushion milestone at $1,000. The ring fills as your typed emergency fund approaches that amount. You
      can adjust the goal in the emergency tracker.
    </>
  );
}

export function ringThreeMonthTip(currentTarget: number, suggested3: number): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Target {formatMoney(currentTarget)}</strong> is your chosen
      savings goal, often about three months of living costs. The template suggested{' '}
      <strong>{formatMoney(suggested3)}</strong> from essentials and debt payments. You can change it under Emergency
      fund. The ring compares saved so far to your target, not a demand from the app.
    </>
  );
}

export function allocationSectionTip(): ReactNode {
  return (
    <>
      The chart uses typed dollars only: essentials (minus groceries), groceries, debt payments, plus savings and
      personal from the fields above the chart. Unallocated appears when planned pay exceeds those wedges.
    </>
  );
}

export function billsTimelineTip(): ReactNode {
  const since = formatCalendarMonthHeading(HISTORY_TRACKING_STARTED_MONTH_KEY);
  return (
    <>
      The checklist starts at <strong className="text-sage-900 dark:text-moss-tip">{since}</strong>. Earlier months
      appear under Past months only. Weekly essentials appear once per Saturday. Mark each row separately. Debts
      with <strong className="text-sage-900 dark:text-moss-tip">Auto deduction</strong> can mark as paid after the due
      date unless you tap Undo paid for that month.
    </>
  );
}

export function walletsTip(): ReactNode {
  return (
    <>
      Optional split of the Personal slice into his and hers fun money, not bank accounts. Spent taps are informal.
      Month reset clears spent only.
    </>
  );
}

export function snowballTip(): ReactNode {
  return (
    <>
      Smallest remaining balance first for motivation. Bar lengths scale to remaining balance. Your real payoff
      order still applies.
    </>
  );
}

export function lifeThisMonthTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Extra cash</strong> is for bonuses, rebates, and gifts.{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Unexpected expenses</strong> sit in their own section
      below the Dashboard. Rows are workbook only unless you reconcile elsewhere.
    </>
  );
}

export function upcomingStripTip(): ReactNode {
  return (
    <>
      The next unpaid items from your bill list. Amounts match Household rows. Full timeline scrolls to the
      calendar. Auto-deduction lines may mark as paid after the due date unless you undid that for the month.
    </>
  );
}

export function emergencySectionTip(): ReactNode {
  return (
    <>
      Type the balance from the account where you keep emergency money. No bank link. Update when you deposit,
      withdraw, or read a statement. Sliders elsewhere are the plan. This box is the balance you choose to record.
    </>
  );
}

export function allocRowEssentialsTip(): ReactNode {
  return (
    <>
      Rent, internet, power, and similar rows from Household essentials, excluding groceries. Dollars use the table,
      not the slider alone.
    </>
  );
}

export function allocRowGroceriesTip(): ReactNode {
  return (
    <>
      From your Groceries row: weekly times four weeks, or a monthly amount. Does not follow the grocery slider for
      dollar math.
    </>
  );
}

export function allocRowDebtTip(): ReactNode {
  return (
    <>
      Sum of monthly payment amounts in your debt table.
    </>
  );
}

export function allocRowSavingsTip(): ReactNode {
  return (
    <>
      Planned income times your savings share. That is intent in the budget, not a bank withdrawal. Type what sits in
      your saver under Rainy-day savings when you transfer money.
    </>
  );
}

export function allocRowPersonalTip(): ReactNode {
  return (
    <>
      Income times personal share. That is combined discretionary money in the plan, not auto-split by spouse. Personal
      wallets below let you set his and hers budgets and light spent tracking.
    </>
  );
}

export function monthlyReportTip(): ReactNode {
  return (
    <>
      Summary and CSV for the month you select. Edits to older deposits update the recap when you save. Nothing is
      bank-synced.
    </>
  );
}

export function pastMonthInsightsTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Paid vs missed</strong> compares scheduled bills to your
      checklist. You can mark missed lines here after the month ends. Extra cash and surprises can be added for that
      month. Paycheque deposits use the table on this card. The live month stays on the Dashboard.
    </>
  );
}

export function householdDataTip(): ReactNode {
  return (
    <>
      Source of truth for planned income, bills, and loans. Debt balances are manual. Optional APR is a hint only.
      Log actual pay in the Paycheque log. Turn on Auto deduction where money leaves automatically so rows can mark
      as paid on schedule.
    </>
  );
}

export function incomeVsSpendTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Primary</strong> is husband&apos;s logged pay.{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Partner</strong> is wife&apos;s. Dark shading is bills
      attributed to that person. When only Primary logged pay this month,{' '}
      <strong className="text-sage-900 dark:text-moss-tip">left</strong> matches{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Left from deposits</strong> above — including bills not yet
      tagged Primary or Partner.
    </>
  );
}
