# Money lenses (developer reference)

The app uses three distinct lenses. UI copy and tooltips must say which lens a number uses.

## 1. Plan lens (Household monthly plan)

- **Source:** `combinedMonthlyIncome`, `allocationBreakdown` in `src/utils/allocation.ts`
- **Uses:** Planned monthly income, essentials/groceries/debt rows, planned savings/personal
- **Not:** Logged paycheques, carry, or bank balance
- **Surfaces:** Dashboard “Planned monthly income”, allocation wedge chart, Monthly report planned columns

## 2. Actual cash lens (workbook cashflow)

- **Source:** `pocketLeftSoFar` in `src/utils/budgetSurplus.ts`
- **Formula:** Pay logged this month + carry (carry spent first) − bills/surprises **due on or before today**
- **Surfaces:**
  - Dashboard “Left from deposits”
  - Income vs spend bar (sole Primary: `remaining` + `carryIn`)
  - Bill calendar heads-up banner (`billCalendarHeadsUp` in `src/utils/moneyConsistency.ts`)
  - Est. weekly room left (`computeSafeSpend` in `src/utils/safeSpend.ts`)
  - Notify relay / widgets (`primaryLeft`, `primaryCarryIn`)

## 3. Upcoming lens (calendar window)

- **Source:** `upcomingDeductionsTotal`, `buildTimeline` in `src/utils/billsTimeline.ts`
- **Uses:** Unpaid bill lines due within N calendar days from today
- **Surfaces:** Bill calendar “due in ten days”, safe-spend subtraction window

## Consistency rules

| Check | Functions |
|-------|-----------|
| Primary left = pocket (sole depositor) | `monthIncomeSpendSummary`, `pocketLeftSoFar` |
| Bill banner second number = pocket | `billCalendarHeadsUp` |
| Weekly buffer from pocket − upcoming | `computeSafeSpend` |
| Planned vs actual ≠ pocket | Actual = full month marked; pocket = due-so-far only |

## Regression tests

`src/utils/moneyConsistency.test.ts` — June Shahil fixture ($473.69 pay, $251.21 carry, $574 spent → $150.90 left).

## Manual verification (after deploy)

- [ ] Dashboard **Left from deposits** = Income chart **left** (Primary)
- [ ] Bill calendar banner cites **Left from deposits**, not plan slack
- [ ] No false “over pay” when carry covers spend
- [ ] Header build stamp: version, `#`, SHA, timestamp updated after hard-refresh
- [ ] Hover tips on snapshot tiles match the lens above
