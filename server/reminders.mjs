const MS_DAY = 86400_000;

/**
 * First calendar month bill reminders consider (must match `HISTORY_TRACKING_STARTED_MONTH_KEY` in `src/data/defaults.ts`).
 * Occurrences before this month are historical placeholders only — not included in email reminders.
 */
const HISTORY_TRACKING_STARTED_MONTH_KEY = '2026-05';

function billTrackingEarliestDueDate() {
  const m = /^(\d{4})-(\d{2})$/.exec(HISTORY_TRACKING_STARTED_MONTH_KEY);
  if (!m) return new Date(2026, 4, 1);
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function calendarDaysAfterDue(ref, due) {
  const a = startOfLocalDay(ref).getTime();
  const b = startOfLocalDay(due).getTime();
  return Math.floor((a - b) / MS_DAY);
}

/** Number of Mon–Fri calendar days from `from` through `to` inclusive. */
function businessDaysInclusiveBetween(from, to) {
  const a = startOfLocalDay(from);
  const b = startOfLocalDay(to);
  if (b < a) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    if (!isWeekend(cur)) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

const dateToMonthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const dueDateLocalKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const setDaySafe = (year, monthIndex, day) => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const d = Math.min(day, last);
  return new Date(year, monthIndex, d);
};

function billPaymentKey(state, row) {
  if (row.category === 'essential') {
    const e = (state.essentials ?? []).find((x) => x.id === row.billId);
    if (e?.cadence === 'week') return dueDateLocalKey(row.due);
  }
  return dateToMonthKey(row.due);
}

function billOccurrenceIsPaid(state, row) {
  const k = billPaymentKey(state, row);
  return (state.billsPaid?.[row.billId] ?? []).includes(k);
}

function billReminderPrefs(state) {
  const grace = Math.min(60, Math.max(0, Math.floor(state.billOverdueGraceDays ?? 0)));
  const lead = Math.min(30, Math.max(1, Math.floor(state.billUpcomingLeadBusinessDays ?? 3)));
  return { overdueGraceDays: grace, upcomingLeadBusinessDays: lead };
}

function billVisualStatus(state, row, ref) {
  if (billOccurrenceIsPaid(state, row)) return 'paid';
  const { overdueGraceDays, upcomingLeadBusinessDays } = billReminderPrefs(state);
  const startToday = startOfLocalDay(ref).getTime();
  const dueT = startOfLocalDay(row.due).getTime();

  if (dueT < startToday) {
    if (calendarDaysAfterDue(ref, row.due) > overdueGraceDays) return 'overdue';
    return 'soon'; // past due but inside grace window
  }

  const bizSpan = businessDaysInclusiveBetween(ref, row.due);
  if (bizSpan <= upcomingLeadBusinessDays) return 'soon';
  return 'upcoming';
}

function essentialInstancesForMonth(e, year, monthIndex) {
  if (e.cadence === 'month') {
    const dom =
      e.dueDay != null && e.dueDay >= 1 && e.dueDay <= 31 ? Math.floor(e.dueDay) : 15;
    return [{ due: setDaySafe(year, monthIndex, dom), amount: e.amount }];
  }
  const out = [];
  const lastDom = new Date(year, monthIndex + 1, 0).getDate();
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const targetDowRaw = e.weeklyDueWeekday;
  const targetDow =
    targetDowRaw != null && Number.isFinite(targetDowRaw) && targetDowRaw >= 0 && targetDowRaw <= 6
      ? Math.floor(targetDowRaw)
      : 6;
  let dom = 1 + ((targetDow - firstDow + 7) % 7);
  while (dom <= lastDom) {
    out.push({ due: new Date(year, monthIndex, dom), amount: e.amount });
    dom += 7;
  }
  if (out.length === 0) {
    out.push({ due: new Date(year, monthIndex, Math.min(7, lastDom)), amount: e.amount });
  }
  return out;
}

function debtInstancesForMonth(d, year, monthIndex) {
  if (d.endsOn) {
    const end = new Date(d.endsOn);
    const due = setDaySafe(year, monthIndex, d.dueDay);
    if (Number.isFinite(end.getTime()) && due.getTime() > end.getTime()) return [];
  }
  const due = setDaySafe(year, monthIndex, d.dueDay);
  return [
    {
      id: `${d.id}-${year}-${monthIndex}`,
      billId: d.id,
      name: d.name,
      amount: d.monthlyPayment,
      due,
      autoDeduction: Boolean(d.autoDeduction),
      category: 'debt',
    },
  ];
}

function buildTimeline(state, monthsAhead = 2, ref = new Date()) {
  const items = [];
  const y0 = ref.getFullYear();
  const m0 = ref.getMonth();
  const lookbackMonths = 6;
  const trackingMonthStart = billTrackingEarliestDueDate().getTime();

  for (let i = -lookbackMonths; i < monthsAhead; i++) {
    const dt = new Date(y0, m0 + i, 1);
    const year = dt.getFullYear();
    const monthIndex = dt.getMonth();
    if (new Date(year, monthIndex, 1).getTime() < trackingMonthStart) continue;

    for (const e of state.essentials ?? []) {
      for (const inst of essentialInstancesForMonth(e, year, monthIndex)) {
        items.push({
          id: `${e.id}-${inst.due.toISOString()}`,
          billId: e.id,
          name: e.name,
          amount: inst.amount,
          due: inst.due,
          autoDeduction: false,
          category: 'essential',
        });
      }
    }
    for (const d of state.debts ?? []) {
      items.push(...debtInstancesForMonth(d, year, monthIndex));
    }
  }

  items.sort((a, b) => a.due.getTime() - b.due.getTime());
  return items;
}

function formatDueIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeReminderEmailPayload(snapshotData, ref = new Date()) {
  const state = snapshotData ?? {};
  const items = buildTimeline(state, 2, ref);
  const startToday = startOfLocalDay(ref).getTime();

  const dueSoon = [];
  const overdue = [];

  for (const b of items) {
    if (billOccurrenceIsPaid(state, b)) continue;
    const status = billVisualStatus(state, b, ref);
    const dueT = startOfLocalDay(b.due).getTime();

    if (status === 'soon') {
      const isPastDue = dueT < startToday;
      const metaBits = [];
      metaBits.push(b.category === 'debt' ? 'Debt' : 'Essential');
      if (b.autoDeduction) metaBits.push('Auto');
      if (isPastDue) metaBits.push('Past due (grace)');
      dueSoon.push({
        name: b.name,
        amount: Number(b.amount ?? 0),
        dueDate: formatDueIso(b.due),
        note: metaBits.join(' · '),
      });
      continue;
    }

    if (status === 'overdue') {
      const metaBits = [];
      metaBits.push(b.category === 'debt' ? 'Debt' : 'Essential');
      if (b.autoDeduction) metaBits.push('Auto');
      overdue.push({
        name: b.name,
        amount: Number(b.amount ?? 0),
        dueDate: formatDueIso(b.due),
        note: metaBits.join(' · '),
      });
    }
  }

  // For reminders, it’s clearer to show upcoming “soon” first, then overdue.
  const sortByDue = (a, b) => a.dueDate.localeCompare(b.dueDate);
  dueSoon.sort(sortByDue);
  overdue.sort(sortByDue);

  const monthKey = dateToMonthKey(ref);
  const counts = { dueSoon: dueSoon.length, overdue: overdue.length };

  return { monthKey, dueSoon, overdue, counts };
}

