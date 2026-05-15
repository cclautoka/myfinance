import type { ReactNode } from 'react';
import { formatCalendarMonthHeading, HISTORY_TRACKING_STARTED_MONTH_KEY } from '../data/defaults';
import { formatMoney } from '../utils/format';

/** Hover “Details” explanations for dashboard & sections */
/** Compare logged deposits vs the Household monthly plan — shown on dashboard & Paycheque log. */
export function dashboardIncomeLoggedVsPlannedTip(planned: number, logged: number): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Planned monthly</strong> is husband + wife totals in Household data — a
      whole month’s picture. <strong className="text-sage-900 dark:text-moss-tip">Logged pay</strong> is only what you typed in the
      Paycheque log this calendar month — it can be lower mid-month because not every deposit has happened yet, or because the
      month really is lighter — that is not an error. Different from <strong>Extra cash</strong> (odd bonuses, gifts outside normal
      pay).
      {logged > 0 && (
        <>
          {' '}
          Right now logged = <strong>{formatMoney(logged)}</strong>, plan = <strong>{formatMoney(planned)}</strong>.
        </>
      )}
    </>
  );
}

export function incomeLogTip(): ReactNode {
  return (
    <>
      Each row is a deposit date and amount. We total them for the{' '}
      <strong className="text-sage-900 dark:text-moss-tip">calendar month</strong> and show that next to your usual monthly plan from Household data.{' '}
      Current month is logged under <strong className="text-sage-900 dark:text-moss-tip">Dashboard</strong>; archived months copy the rows for whichever month you pick under <strong className="text-sage-900 dark:text-moss-tip">Past months</strong> — pick the matching block so totals line up with what you expect.
      If you set pay rhythm (weekly / biweekly / monthly) and optional “usual amount per cheque,” we also estimate how much of each deposit looks like{' '}
      <strong>OT or extra on that pay</strong> versus your baseline — different from the Extra cash box, which is for bonuses, gifts, etc.
      This does <em>not</em> change sliders or allocation math. Tag “joint” for shared deposits; husband/wife drive the baseline math.
    </>
  );
}

export function dashboardIncomeTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Planned</strong> usual pay: husband + wife monthly fields in{' '}
      <strong>Household data</strong>. Surprise bumps go in <strong>Extra cash</strong>; actual cheques vs this plan go in the{' '}
      <strong>Paycheque log</strong> (see deposit total on the dashboard when you start logging).
    </>
  );
}

export function dashboardVariablePayTip(): ReactNode {
  return (
    <>
      We compare each logged <strong className="text-sage-900 dark:text-moss-tip">husband / wife</strong> deposit to the usual cheque
      implied by Household (pay rhythm and optional per-pay override). The gap is an <strong className="text-sage-900 dark:text-moss-tip">estimate of variable pay</strong> — it does not roll into allocation until you reflect it (Extra cash, savings balance, or bigger card payments you type by hand).
    </>
  );
}

export function dashboardEarnerSplitTip(): ReactNode {
  return (
    <>
      Takes the <strong className="text-sage-900 dark:text-moss-tip">dollar plan</strong> from essentials, groceries, debts, savings
      %, and personal % — then pretends that bucket is covered <strong className="text-sage-900 dark:text-moss-tip">in proportion to
      each spouse’s planned salary</strong>. What’s left per person always adds up to the household “unallocated” remainder. It is a
      lens, not automatic bank logic.
    </>
  );
}

export function dashboardEmergencyTip(): ReactNode {
  return (
    <>
      This number is <strong className="text-sage-900 dark:text-moss-tip">whatever you say is in your real savings</strong> —
      for example the balance in a joint Westpac savings account you both use for emergencies. The app{' '}
      <strong>never</strong> connects to your bank or sees transfers. When you move money in or out (or check the account), come
      here and type the new total so the dashboard and rings stay truthful.
    </>
  );
}

export function dashboardDebtTip(): ReactNode {
  return (
    <>
      Rough total still owed across cards, loans, and personal lines in your Household table — including estimates for HP/car
      when balance is blank. <strong className="text-sage-900 dark:text-moss-tip">Interest is never added automatically</strong> — type
      the balance from each statement when you reconcile. Useful for morale, not a legal payoff quote.
    </>
  );
}

export function debtBalancesPanelTip(): ReactNode {
  return (
    <>
      One-place view of each row&apos;s <strong className="text-sage-900 dark:text-moss-tip">effective balance</strong> (typed
      statement balance, or installment estimate when blank). APR is optional — if you enter it under Household debts, ~interest/mo
      is roughly balance × APR ÷ 12 (simplified); it still does <strong>not</strong> roll into what you owe in the spreadsheet.
    </>
  );
}

export function dashboardNextBillTip(): ReactNode {
  return (
    <>
      The next <strong className="text-sage-900 dark:text-moss-tip">unchecked</strong> line that is still <strong className="text-sage-900 dark:text-moss-tip">due today or later</strong>{' '}
      on your checklist. Older unpaid rows stay at the top of the Bill calendar until you mark them — they show separately here as a
      backlog alert when needed. Marking handled updates this card without reloading.
    </>
  );
}

export function dashboardSafeSpendTip(): ReactNode {
  return (
    <>
      Approximate leftover per week after essentials, groceries, debt payments, and savings (from sliders), with a gentle
      haircut if big bills bunch up soon. Rough estimate only — not spending permission or denial.
    </>
  );
}

export function dashboardBillsTickedTip(): ReactNode {
  return (
    <>
      How many <strong className="text-sage-900 dark:text-moss-tip">individual rows</strong> with a due date in this calendar month you
      marked handled. Weekly lines (like groceries) are <strong className="text-sage-900 dark:text-moss-tip">each week separately</strong> — checking one Saturday does not check the whole month. Debts usually use one mark per calendar month.
    </>
  );
}

export function dashboardDebtFreeMonthsTip(): ReactNode {
  return (
    <>
      Divides estimated debt remaining by monthly payments — very rough. Useful directionally; ignores interest, lump sums,
      snowball redirects, etc.
    </>
  );
}

export function dashboardSavingsSliderTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Intent:</strong> your <strong>planned monthly savings dollars</strong>{' '}
      from Plan &amp; bills → monthly split (not a % anymore).{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Achieved:</strong> the typed backup / emergency balance (same numbers as
      the Emergency fund metric above and under Plan → Rainy‑day savings).
    </>
  );
}

export function dashboardPlannedVsActualExpensesTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Planned</strong> sums what you typed in Household + Plan: essentials
      (monthly + weekly at 4×/mo), groceries row, all loan/HP <strong>payments</strong>, plus planned savings and personal dollars —
      same wedge math as the allocation card.{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Actual</strong> counts only what the workbook already captures for{' '}
      <strong>this calendar month</strong>:
      for cashflow: bill lines with a due date in this calendar month that you <strong>marked handled</strong> (using actual paid
      when you entered it), plus <strong>Unexpected expenses</strong> dated this month. It is not a bank feed; unmarked bills do not
      add here.
    </>
  );
}

export function ringFirst1kTip(): ReactNode {
  return (
    <>
      A classic starter cushion milestone ($1,000). The ring fills as your typed emergency fund approaches that amount —
      customizable goal in Emergency fund tracker.
    </>
  );
}

export function ringThreeMonthTip(currentTarget: number, suggested3: number): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">
        Why does it say “{formatMoney(currentTarget)}”?
      </strong>{' '}
      That dollar amount is your <strong>chosen savings goal</strong> for a bigger rainy-day cushion — often described as “about
      three months of living costs,” but only you decide what counts as living costs.
      The template picked <strong>{formatMoney(suggested3)}</strong> (~3× essentials + debt payments from Household data); you may
      have changed it. It is <strong className="text-sage-900 dark:text-moss-tip">editable</strong> under Emergency fund → “3‑month
      target.” The ring simply compares what you&apos;ve saved so far to <em>your</em> target — not a demand from the app.
    </>
  );
}

export function allocationSectionTip(): ReactNode {
  return (
    <>
      The <strong className="text-sage-900 dark:text-moss-tip">donut</strong> is built from <strong>typed dollars only</strong>:
      essentials (minus groceries row), groceries, and debt payments from Household;{' '}
      <strong>savings</strong> and <strong>personal</strong> from the two amount fields above the chart — not allocation % sliders.{' '}
      <strong>Unallocated</strong> appears when planned pay exceeds all of those wedges.
    </>
  );
}

export function billsTimelineTip(): ReactNode {
  const since = formatCalendarMonthHeading(HISTORY_TRACKING_STARTED_MONTH_KEY);
  return (
    <>
      The checklist starts at <strong className="text-sage-900 dark:text-moss-tip">{since}</strong> — nothing before then appears as
      due or overdue (April and earlier stay in Past months only as a quiet placeholder). Built from Household data. Weekly
      essentials (groceries, etc.) appear once per <strong className="text-sage-900 dark:text-moss-tip">Saturday</strong> in that month — mark handled on each row separately. Labels like “Needs a look” are reminders, not grades. Debts marked{' '}
      <strong className="text-sage-900 dark:text-moss-tip">Auto deduction</strong> switch to handled automatically after their due date passes this month — unless someone tapped{' '}
      <strong>Undo paid</strong>; then we remember not to flip them back on every visit. Manual bills stay manual.
    </>
  );
}

export function walletsTip(): ReactNode {
  return (
    <>
      Two optional lanes for splitting the allocation <strong className="text-sage-900 dark:text-moss-tip">Personal</strong> slice into whose fun money is
      whose — not bank accounts. Husband budget + wife budget is your chosen split; compare the sum to the Personal dollars in allocation if you want them
      to line up. Spent taps are informal; month resets wipe spent only.
    </>
  );
}

export function snowballTip(): ReactNode {
  return (
    <>
      Smallest remaining balance first — a visual order, not a mandate. The chart and the grey strip under each row both scale
      lengths to <strong className="text-sage-900 dark:text-moss-tip">remaining balance</strong> vs the largest balance on this list
      (including HP-style estimates when balance is empty). Your real bank rules still win.
    </>
  );
}

export function lifeThisMonthTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Extra cash</strong>: bonuses, rebates, gifts, side income — logged
      here. <strong className="text-sage-900 dark:text-moss-tip">Unexpected bills</strong> now live below the Dashboard in their
      own band for visibility. Rows are bookkeeping only unless you reconcile elsewhere.
    </>
  );
}

export function upcomingStripTip(): ReactNode {
  return (
    <>
      The next few unpaid items from the same bill list — higher contrast so nothing sneaks up on you. Amounts match Household
      rows. “Full timeline” scrolls to check things off. Auto-deduction lines can show handled on their own after the due date unless you undid that for the month.
    </>
  );
}

export function emergencySectionTip(): ReactNode {
  return (
    <>
      This is a <strong className="text-sage-900 dark:text-moss-tip">manual tracker</strong>: type the balance from the account
      where you actually park emergency money (joint saver, etc.). No bank link — you update it when you deposit, withdraw, or
      read your statement. The sliders and “savings %” elsewhere are the <em>plan</em>; this box is the{' '}
      <em>balance you choose to record</em>.
    </>
  );
}

export function allocRowEssentialsTip(): ReactNode {
  return (
    <>
      Rent, internet, power, etc. Pulled from Household essentials (excluding the groceries line). The matching slider is only a
      mental picture — dollars use the table.
    </>
  );
}

export function allocRowGroceriesTip(): ReactNode {
  return (
    <>
      From your Groceries row: weekly × 4 weeks → monthly, or a straight monthly number. Does not follow the grocery slider for
      dollar math.
    </>
  );
}

export function allocRowDebtTip(): ReactNode {
  return (
    <>
      Sum of every “Payment” column in your debt table — what actually leaves your account each month for those items.
    </>
  );
}

export function allocRowSavingsTip(): ReactNode {
  return (
    <>
      Husband+wife planned income × your savings slider %. That is your <strong className="text-sage-900 dark:text-moss-tip">intent</strong>{' '}
      in this budget —not a bank withdrawal. Type what actually sits in Westpac / your saver under <strong>Rainy‑day savings</strong>; update
      that balance (+/− buttons or edit) whenever you transfer in or pull money out.
    </>
  );
}

export function allocRowPersonalTip(): ReactNode {
  return (
    <>
      Income × personal slider %. That dollar amount is the <strong className="text-sage-900 dark:text-moss-tip">combined</strong> discretionary lane
      in the monthly plan — <strong>not</strong> automatically split husband vs wife. Next section (Personal wallets) lets you divide that idea into two
      budgets and tap light “spent” tracking; set each budget yourselves so his + hers matches how you actually run money.
    </>
  );
}

export function monthlyReportTip(): ReactNode {
  return (
    <>
      Open a readable summary for the selected calendar month plus CSV. Tweaking older deposits or extras updates this recap as soon
      as you save — Household data still drives today’s dashboard sliders. Nothing is bank-synced.
    </>
  );
}

export function pastMonthInsightsTip(): ReactNode {
  return (
    <>
      <strong className="text-sage-900 dark:text-moss-tip">Handled / missed</strong> compares scheduled bill lines that month against your
      checklist keys (weekly groceries still one row per week). You can tick missed lines here even after the month ends. Extra cash &
      surprise costs can be <strong className="text-sage-900 dark:text-moss-tip">added for this month</strong> with the forms in the recap (date must stay in the month you picked) or edited / removed below
      that. Paycheque deposits use the separate table under this card. The History picker only lists past months; the live month stays on the Dashboard.
    </>
  );
}

export function householdDataTip(): ReactNode {
  return (
    <>
      Source of truth for <strong className="text-sage-900 dark:text-moss-tip">planned</strong> income, bills, and loans. Everything else reads from here.
      Debt <strong className="text-sage-900 dark:text-moss-tip">balances are manual</strong> (statement amount); optionally add APR % for an interest heads-up — balances do not compound in the background.
      Actual deposits vs that plan belong in the <strong>Paycheque log</strong>. Toggle <strong>Auto deduction</strong> where money leaves automatically so handled checkmarks can follow the calendar.
      Add rows when life changes — no need to perfect it on day one.
    </>
  );
}
