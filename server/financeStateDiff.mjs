/** Server-side finance state diff (keep in sync with src/utils/financeStateDiff.ts for audit logs). */

const MAX_ITEMS = 32;

const fmtMoney = (n) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

function cmpNum(a, b) {
  return Math.round(Number(a) * 100) !== Math.round(Number(b) * 100);
}

function pushItem(items, title, body, meta) {
  if (items.length >= MAX_ITEMS) return false;
  items.push({ title, body, meta });
  return true;
}

function billLabel(state, billId) {
  const e = (state.essentials ?? []).find((x) => x.id === billId);
  if (e?.name) return e.name;
  const d = (state.debts ?? []).find((x) => x.id === billId);
  if (d?.name) return d.name;
  return billId;
}

function formatPeriodKey(key) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return key;
}

function diffBillsPaid(from, to, items) {
  const ids = new Set([...Object.keys(from.billsPaid ?? {}), ...Object.keys(to.billsPaid ?? {})]);
  for (const id of ids) {
    const aSet = new Set(from.billsPaid?.[id] ?? []);
    const bSet = new Set(to.billsPaid?.[id] ?? []);
    const name = billLabel(to, id);
    for (const k of bSet) {
      if (!aSet.has(k)) pushItem(items, 'Marked as handled', `${name} (${formatPeriodKey(k)})`);
    }
    for (const k of aSet) {
      if (!bSet.has(k)) pushItem(items, 'Unmarked as handled', `${name} (${formatPeriodKey(k)})`);
    }
  }
}

function diffBillPaidAmounts(from, to, items) {
  const aOuter = from.billPaidAmounts ?? {};
  const bOuter = to.billPaidAmounts ?? {};
  const billIds = new Set([...Object.keys(aOuter), ...Object.keys(bOuter)]);
  for (const bid of billIds) {
    const aIn = aOuter[bid] ?? {};
    const bIn = bOuter[bid] ?? {};
    const keys = new Set([...Object.keys(aIn), ...Object.keys(bIn)]);
    const name = billLabel(to, bid);
    for (const k of keys) {
      const av = aIn[k];
      const bv = bIn[k];
      if (av === bv) continue;
      pushItem(
        items,
        'Actual paid amount',
        `${name} (${formatPeriodKey(k)})`,
        `${av === undefined ? '—' : fmtMoney(av)} → ${bv === undefined ? '—' : fmtMoney(bv)}`,
      );
    }
  }
}

function mapById(rows) {
  const m = new Map();
  for (const r of rows ?? []) {
    if (r?.id) m.set(r.id, r);
  }
  return m;
}

function diffIncome(from, to, items) {
  const keys = [
    'husbandMonthly',
    'wifeMonthly',
    'husbandPayNote',
    'wifePayNote',
    'husbandPaySchedule',
    'wifePaySchedule',
    'husbandTypicalPerPay',
    'wifeTypicalPerPay',
    'husbandPayAutoLog',
    'wifePayAutoLog',
    'husbandPayAnchor',
    'wifeBiweeklyPayAnchor',
  ];
  for (const k of keys) {
    const a = from[k];
    const b = to[k];
    if (a === b) continue;
    const body =
      typeof a === 'number' && typeof b === 'number'
        ? `${fmtMoney(a)} → ${fmtMoney(b)}`
        : `${String(a ?? '')} → ${String(b ?? '')}`;
    pushItem(items, `Income · ${k}`, body);
  }
}

function diffAllocation(from, to, items) {
  for (const k of ['essentials', 'debt', 'savings', 'groceries', 'personal']) {
    if (from[k] === to[k]) continue;
    pushItem(items, `Allocation · ${k}`, `${from[k]}% → ${to[k]}%`);
  }
}

function diffEssentialRow(a, b, items) {
  const name = b.name || a.name || 'Essential';
  if (a.name !== b.name) pushItem(items, `Essential · ${name}`, `Renamed from “${a.name}”`);
  if (cmpNum(a.amount, b.amount)) pushItem(items, `Essential · ${name}`, `Amount ${fmtMoney(a.amount)} → ${fmtMoney(b.amount)}`);
  if (a.cadence !== b.cadence) pushItem(items, `Essential · ${name}`, `Cadence ${a.cadence} → ${b.cadence}`);
  if ((a.dueDay ?? null) !== (b.dueDay ?? null))
    pushItem(items, `Essential · ${name}`, `Due day ${a.dueDay ?? '—'} → ${b.dueDay ?? '—'}`);
  if ((a.weeklyDueWeekday ?? null) !== (b.weeklyDueWeekday ?? null))
    pushItem(items, `Essential · ${name}`, `Weekday ${a.weeklyDueWeekday ?? '—'} → ${b.weeklyDueWeekday ?? '—'}`);
}

function diffDebtRow(a, b, items) {
  const name = b.name || a.name || 'Debt';
  if (a.name !== b.name) pushItem(items, `Debt · ${name}`, `Renamed from “${a.name}”`);
  if (cmpNum(a.balance, b.balance)) pushItem(items, `Debt · ${name}`, `Balance ${fmtMoney(a.balance)} → ${fmtMoney(b.balance)}`);
  if (cmpNum(a.monthlyPayment, b.monthlyPayment))
    pushItem(items, `Debt · ${name}`, `Payment ${fmtMoney(a.monthlyPayment)} → ${fmtMoney(b.monthlyPayment)}`);
  if (a.dueDay !== b.dueDay) pushItem(items, `Debt · ${name}`, `Due day ${a.dueDay} → ${b.dueDay}`);
  if (Boolean(a.autoDeduction) !== Boolean(b.autoDeduction))
    pushItem(items, `Debt · ${name}`, `Auto-deduct ${a.autoDeduction ? 'on' : 'off'} → ${b.autoDeduction ? 'on' : 'off'}`);
  if ((a.endsOn ?? '') !== (b.endsOn ?? ''))
    pushItem(items, `Debt · ${name}`, `Ends ${a.endsOn ?? '—'} → ${b.endsOn ?? '—'}`);
}

function diffIdRows(label, fromRows, toRows, diffRow, items) {
  const aM = mapById(fromRows);
  const bM = mapById(toRows);
  for (const id of new Set([...aM.keys(), ...bM.keys()])) {
    const a = aM.get(id);
    const b = bM.get(id);
    if (!a && b) {
      const name = b.name ?? id;
      const amt = typeof b.amount === 'number' ? fmtMoney(b.amount) : '';
      pushItem(items, `${label} row added`, amt ? `${name} (${amt})` : name);
      continue;
    }
    if (a && !b) {
      pushItem(items, `${label} row removed`, a.name ?? id);
      continue;
    }
    if (a && b) diffRow(a, b, items);
  }
}

function diffLogArray(label, from, to, describe, items) {
  const aM = mapById(from);
  const bM = mapById(to);
  for (const id of new Set([...aM.keys(), ...bM.keys()])) {
    const a = aM.get(id);
    const b = bM.get(id);
    if (!a && b) {
      pushItem(items, `${label} added`, describe(b));
      continue;
    }
    if (a && !b) {
      pushItem(items, `${label} removed`, describe(a));
      continue;
    }
    if (a && b && JSON.stringify(a) !== JSON.stringify(b)) {
      pushItem(items, `${label} updated`, describe(b), describe(a));
    }
  }
}

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {object} from
 * @param {object} to
 */
export function computeFinanceStateDiff(from, to) {
  const items = [];

  diffIncome(from.income ?? {}, to.income ?? {}, items);

  if (cmpNum(from.plannedSavingsMonthly, to.plannedSavingsMonthly)) {
    pushItem(
      items,
      'Plan dollars',
      `Planned savings / mo ${fmtMoney(from.plannedSavingsMonthly)} → ${fmtMoney(to.plannedSavingsMonthly)}`,
    );
  }
  if (cmpNum(from.plannedPersonalMonthly, to.plannedPersonalMonthly)) {
    pushItem(
      items,
      'Plan dollars',
      `Planned personal / mo ${fmtMoney(from.plannedPersonalMonthly)} → ${fmtMoney(to.plannedPersonalMonthly)}`,
    );
  }

  diffAllocation(from.allocation ?? {}, to.allocation ?? {}, items);

  const wFrom = from.wallets ?? {};
  const wTo = to.wallets ?? {};
  if (cmpNum(wFrom.husbandBudget, wTo.husbandBudget))
    pushItem(items, 'Wallets', `Husband budget ${fmtMoney(wFrom.husbandBudget)} → ${fmtMoney(wTo.husbandBudget)}`);
  if (cmpNum(wFrom.wifeBudget, wTo.wifeBudget))
    pushItem(items, 'Wallets', `Wife budget ${fmtMoney(wFrom.wifeBudget)} → ${fmtMoney(wTo.wifeBudget)}`);
  if (cmpNum(wFrom.husbandSpent, wTo.husbandSpent))
    pushItem(items, 'Wallets', `Husband spent ${fmtMoney(wFrom.husbandSpent)} → ${fmtMoney(wTo.husbandSpent)}`);
  if (cmpNum(wFrom.wifeSpent, wTo.wifeSpent))
    pushItem(items, 'Wallets', `Wife spent ${fmtMoney(wFrom.wifeSpent)} → ${fmtMoney(wTo.wifeSpent)}`);

  if (cmpNum(from.emergencyFund, to.emergencyFund)) {
    pushItem(items, 'Emergency fund', `${fmtMoney(from.emergencyFund)} → ${fmtMoney(to.emergencyFund)}`);
  }
  if (cmpNum(from.threeMonthFundTarget, to.threeMonthFundTarget)) {
    pushItem(
      items,
      '3‑month target',
      `${fmtMoney(from.threeMonthFundTarget)} → ${fmtMoney(to.threeMonthFundTarget)}`,
    );
  }

  const mk = monthKeyNow();
  const carryFrom = from.monthSpendableCarryByMonth?.[mk];
  const carryTo = to.monthSpendableCarryByMonth?.[mk];
  if (carryFrom !== carryTo) {
    pushItem(
      items,
      'Spendable carry-in',
      mk,
      `${carryFrom === undefined ? '—' : fmtMoney(Number(carryFrom))} → ${carryTo === undefined ? '—' : fmtMoney(Number(carryTo))}`,
    );
  }

  if ((from.billOverdueGraceDays ?? 0) !== (to.billOverdueGraceDays ?? 0)) {
    pushItem(
      items,
      'Bill preferences',
      `Overdue grace days ${from.billOverdueGraceDays ?? 0} → ${to.billOverdueGraceDays ?? 0}`,
    );
  }

  diffIdRows('Essential', from.essentials, to.essentials, diffEssentialRow, items);
  diffIdRows('Debt', from.debts, to.debts, diffDebtRow, items);

  diffBillsPaid(from, to, items);
  diffBillPaidAmounts(from, to, items);

  diffLogArray(
    'Paycheque log',
    from.incomeLog,
    to.incomeLog,
    (e) => `${e.date} · ${e.earner} · ${fmtMoney(e.amount)} · ${e.label}`,
    items,
  );
  diffLogArray(
    'Extra income',
    from.extraIncome,
    to.extraIncome,
    (e) => `${e.date} · ${fmtMoney(e.amount)} · ${e.label}`,
    items,
  );
  diffLogArray(
    'Unexpected expense',
    from.surpriseExpenses,
    to.surpriseExpenses,
    (e) => `${e.date} · ${fmtMoney(e.amount)} · ${e.label}`,
    items,
  );
  diffLogArray(
    'Surplus sweep',
    from.budgetSurplusSweeps,
    to.budgetSurplusSweeps,
    (e) => `${e.monthKey} · ${fmtMoney(e.amount)} · ${e.date}`,
    items,
  );

  const truncated = items.length >= MAX_ITEMS;
  const sections = [];
  if (items.length > 0) {
    sections.push({ heading: 'What changed', items: items.slice(0, MAX_ITEMS) });
  } else if (JSON.stringify(from) !== JSON.stringify(to)) {
    sections.push({
      heading: 'What changed',
      body: 'Other workbook settings changed (theme, version, or fields not listed in the audit).',
    });
  }

  if (truncated) {
    sections.push({
      heading: 'Note',
      body: `Only the first ${MAX_ITEMS} changes are shown. Open the workbook for the full picture.`,
    });
  }

  return { sections, truncated };
}

/** @param {{ sections: { heading: string; body?: string; items?: { title: string; body?: string }[] }[] }} diff */
export function auditSummaryFromDiff(diff) {
  const section = diff.sections?.find((s) => s.heading === 'What changed');
  const items = section?.items ?? [];
  if (items.length >= 1) {
    const first = items[0];
    const line = [first.title, first.body].filter(Boolean).join(' — ');
    if (items.length === 1) return line;
    const titles = [...new Set(items.map((i) => i.title))];
    if (titles.length === 1) return `${line} (+${items.length - 1} more)`;
    return `${items.length} changes — ${line}`;
  }
  const body = section?.body;
  if (body) {
    if (/omitted|not listed/i.test(body)) return 'Other workbook settings updated';
    return String(body).slice(0, 140);
  }
  return 'Workbook saved';
}
