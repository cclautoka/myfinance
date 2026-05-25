/** Server-side finance state diff (mirrors src/utils/financeStateDiff.ts for audit logs). */

const MAX_ITEMS = 32;

const fmtMoney = (n) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

function cmpNum(a, b) {
  return Math.round(a * 100) !== Math.round(b * 100);
}

function pushItem(items, title, body, meta) {
  if (items.length >= MAX_ITEMS) return false;
  items.push({ title, body, meta });
  return true;
}

function diffBillsPaid(from, to, items) {
  const ids = new Set([...Object.keys(from.billsPaid ?? {}), ...Object.keys(to.billsPaid ?? {})]);
  for (const id of ids) {
    const a = [...(from.billsPaid?.[id] ?? [])].sort().join(',');
    const b = [...(to.billsPaid?.[id] ?? [])].sort().join(',');
    if (a === b) continue;
    pushItem(items, 'Bill checkmarks', `${id}: paid keys changed`, `${a || '—'} → ${b || '—'}`);
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
    for (const k of keys) {
      const av = aIn[k];
      const bv = bIn[k];
      if (av === bv) continue;
      pushItem(
        items,
        'Actual paid amount',
        `${bid} · ${k}`,
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

/**
 * @param {object} from
 * @param {object} to
 */
export function computeFinanceStateDiff(from, to) {
  const items = [];

  if (cmpNum(from.plannedSavingsMonthly, to.plannedSavingsMonthly)) {
    pushItem(
      items,
      'Plan dollars',
      `Planned savings / mo: ${fmtMoney(from.plannedSavingsMonthly)} → ${fmtMoney(to.plannedSavingsMonthly)}`,
    );
  }
  if (cmpNum(from.emergencyFund, to.emergencyFund)) {
    pushItem(items, 'Emergency fund', `${fmtMoney(from.emergencyFund)} → ${fmtMoney(to.emergencyFund)}`);
  }

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
    'Unexpected expenses',
    from.surpriseExpenses,
    to.surpriseExpenses,
    (e) => `${e.date} · ${fmtMoney(e.amount)} · ${e.label}`,
    items,
  );

  const truncated = items.length >= MAX_ITEMS;
  const sections = [];
  if (items.length > 0) {
    sections.push({ heading: 'What changed', items: items.slice(0, MAX_ITEMS) });
  } else if (JSON.stringify(from) !== JSON.stringify(to)) {
    sections.push({
      heading: 'What changed',
      body: 'Workbook updated (field-level detail omitted).',
    });
  }

  if (truncated) {
    sections.push({
      heading: 'Note',
      body: `Some changes were omitted after the first ${MAX_ITEMS} lines.`,
    });
  }

  return { sections, truncated };
}

/** @param {{ sections: { heading: string; items?: { title: string }[] }[] }} diff */
export function auditSummaryFromDiff(diff) {
  const items = diff.sections?.find((s) => s.heading === 'What changed')?.items;
  if (items?.length) return items[0].title;
  const body = diff.sections?.find((s) => s.heading === 'What changed')?.body;
  if (body) return String(body).slice(0, 120);
  return 'Workbook saved';
}
