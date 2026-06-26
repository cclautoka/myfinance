const MS_DAY = 86400_000;

/** Unpaid “upcoming” bills due within this many calendar days — keep aligned with `SAVE_EMAIL_BILL_HORIZON_CALENDAR_DAYS` in client `reminderEmailPayloadClient.ts`. */
export const REMINDER_EMAIL_HORIZON_CALENDAR_DAYS = 14;

const MAX_REMINDER_ROWS = 25;

/**
 * First calendar month bill reminders consider (must match `HISTORY_TRACKING_STARTED_MONTH_KEY` in `src/data/defaults.ts`).
 * Occurrences before this month are historical placeholders only — not included in email reminders.
 */
const HISTORY_TRACKING_STARTED_MONTH_KEY = '2026-06';

function billTrackingEarliestDueDate() {
  const m = /^(\d{4})-(\d{2})$/.exec(HISTORY_TRACKING_STARTED_MONTH_KEY);
  if (!m) return new Date(2026, 5, 1);
  return new Date(Number(m[1]), Number(m[2]) - 1, 1);
}

/**
 * Local-midnight ms of the earliest bill occurrence this workbook tracks: the app-wide floor raised
 * to the household's own fresh-start day (`trackingStartedOn`) when set. Mirrors
 * `householdTrackingStartMs` in `src/utils/billsTimeline.ts` so emails match the in-app view.
 */
function householdTrackingStartMs(state) {
  const globalMs = billTrackingEarliestDueDate().getTime();
  const iso = state?.trackingStartedOn;
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isNaN(d.getTime())) return Math.max(globalMs, startOfLocalDay(d).getTime());
  }
  return globalMs;
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

/** Keep in sync with `src/utils/businessDays.ts` — lead window excludes “today”. */
function startOfNextCalendarDay(ref) {
  const d = startOfLocalDay(ref);
  d.setDate(d.getDate() + 1);
  return d;
}

function businessWeekdaysFromTomorrowThroughDueInclusive(ref, due) {
  const dueStart = startOfLocalDay(due).getTime();
  const refStart = startOfLocalDay(ref).getTime();
  if (dueStart <= refStart) return 0;
  return businessDaysInclusiveBetween(startOfNextCalendarDay(ref), due);
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

/** Keep in sync with `src/utils/billsTimeline.ts` `billVisualStatus`. */
function billVisualStatus(state, row, ref) {
  if (billOccurrenceIsPaid(state, row)) return 'paid';
  const { overdueGraceDays, upcomingLeadBusinessDays } = billReminderPrefs(state);
  const startToday = startOfLocalDay(ref).getTime();
  const dueT = startOfLocalDay(row.due).getTime();

  if (dueT === startToday) return 'overdue';

  if (dueT < startToday) {
    if (calendarDaysAfterDue(ref, row.due) > overdueGraceDays) return 'overdue';
    return 'soon'; // past due but inside grace window
  }

  const bizSpan = businessWeekdaysFromTomorrowThroughDueInclusive(ref, row.due);
  if (bizSpan > 0 && bizSpan <= upcomingLeadBusinessDays) return 'soon';
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
  // Drop occurrences before this household's fresh-start day (no pre-June dues for a June household).
  const trackingStartMs = householdTrackingStartMs(state);
  return items.filter((b) => startOfLocalDay(b.due).getTime() >= trackingStartMs);
}

function formatDueIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Days since the bill left the grace window (1 = first calendar day truly overdue). */
export function daysSinceGraceEnded(ref, due, graceDays) {
  const afterDue = calendarDaysAfterDue(ref, due);
  if (afterDue <= graceDays) return 0;
  return afterDue - graceDays;
}

/** Overdue email cadence: day 3, day 7, then every 7 days from day 14 onward. */
export function isOverdueCadenceDay(daysSince) {
  if (daysSince === 3 || daysSince === 7) return true;
  if (daysSince >= 14 && daysSince % 7 === 0) return true;
  return false;
}

function rowMeta(state, b, ref, extra = []) {
  const bits = [];
  bits.push(b.category === 'debt' ? 'Debt' : 'Essential');
  if (b.autoDeduction) bits.push('Auto');
  bits.push(...extra);
  return bits.join(' · ');
}

function toReminderRow(state, b, ref, extraMeta = []) {
  return {
    billId: b.billId,
    paymentKey: billPaymentKey(state, b),
    name: b.name,
    amount: Number(b.amount ?? 0),
    dueDate: formatDueIso(b.due),
    note: rowMeta(state, b, ref, extraMeta),
  };
}

/** Unpaid bills due on `ref`’s calendar day (email at 7am). */
export function computeDueTodayEmailPayload(snapshotData, ref = new Date()) {
  const state = snapshotData ?? {};
  const items = buildTimeline(state, 2, ref);
  const startToday = startOfLocalDay(ref).getTime();
  const dueToday = [];

  for (const b of items) {
    if (billOccurrenceIsPaid(state, b)) continue;
    const dueT = startOfLocalDay(b.due).getTime();
    if (dueT !== startToday) continue;
    dueToday.push(toReminderRow(state, b, ref, ['Due today']));
  }

  dueToday.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const cap = (arr) => (arr.length > MAX_REMINDER_ROWS ? arr.slice(0, MAX_REMINDER_ROWS) : arr);
  return { monthKey: dateToMonthKey(ref), dueToday: cap(dueToday) };
}

/**
 * Overdue past grace on cadence days (3, 7, 14, 21…). Excludes due-today rows (those use due-today email).
 * @param {Record<string, Record<string, string>>|undefined} sentLog billId -> paymentKey -> YYYY-MM-DD last sent
 */
export function computeOverdueCadenceEmailPayload(snapshotData, ref = new Date(), sentLog = {}) {
  const state = snapshotData ?? {};
  const { overdueGraceDays } = billReminderPrefs(state);
  const items = buildTimeline(state, 2, ref);
  const startToday = startOfLocalDay(ref).getTime();
  const todayKey = dueDateLocalKey(ref);
  const overdueCadence = [];

  for (const b of items) {
    if (billOccurrenceIsPaid(state, b)) continue;
    const status = billVisualStatus(state, b, ref);
    if (status !== 'overdue') continue;
    const dueT = startOfLocalDay(b.due).getTime();
    if (dueT === startToday) continue;

    const daysSince = daysSinceGraceEnded(ref, b.due, overdueGraceDays);
    if (!isOverdueCadenceDay(daysSince)) continue;

    const payKey = billPaymentKey(state, b);
    const lastSent = sentLog?.[b.billId]?.[payKey];
    if (lastSent === todayKey) continue;

    overdueCadence.push(
      toReminderRow(state, b, ref, [`${daysSince} day${daysSince === 1 ? '' : 's'} past grace`]),
    );
  }

  overdueCadence.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const cap = (arr) => (arr.length > MAX_REMINDER_ROWS ? arr.slice(0, MAX_REMINDER_ROWS) : arr);
  return { monthKey: dateToMonthKey(ref), overdueCadence: cap(overdueCadence) };
}

/** Daily push + widget buckets (due soon, overdue, horizon). */
export function computeDailyPushReminderPayload(snapshotData, ref = new Date()) {
  const state = snapshotData ?? {};
  const items = buildTimeline(state, 2, ref);
  const startToday = startOfLocalDay(ref).getTime();
  const horizonEnd = startToday + REMINDER_EMAIL_HORIZON_CALENDAR_DAYS * MS_DAY;

  const dueSoon = [];
  const overdue = [];
  const horizon = [];

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
      const dueToday = dueT === startToday;
      if (dueToday) metaBits.push('Due today');
      overdue.push({
        name: b.name,
        amount: Number(b.amount ?? 0),
        dueDate: formatDueIso(b.due),
        dueToday,
        note: metaBits.join(' · '),
      });
      continue;
    }

    if (status === 'upcoming' && dueT >= startToday && dueT <= horizonEnd) {
      const metaBits = [];
      metaBits.push(b.category === 'debt' ? 'Debt' : 'Essential');
      if (b.autoDeduction) metaBits.push('Auto');
      metaBits.push(`Due in ≤${REMINDER_EMAIL_HORIZON_CALENDAR_DAYS}d`);
      horizon.push({
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
  horizon.sort(sortByDue);

  const cap = (arr) => (arr.length > MAX_REMINDER_ROWS ? arr.slice(0, MAX_REMINDER_ROWS) : arr);
  const dueSoonC = cap(dueSoon);
  const overdueC = cap(overdue);
  const horizonC = cap(horizon);

  const monthKey = dateToMonthKey(ref);
  const counts = {
    dueSoon: dueSoonC.length,
    overdue: overdueC.length,
    horizon: horizonC.length,
    truncated:
      dueSoon.length > MAX_REMINDER_ROWS ||
      overdue.length > MAX_REMINDER_ROWS ||
      horizon.length > MAX_REMINDER_ROWS,
  };

  return { monthKey, dueSoon: dueSoonC, overdue: overdueC, horizon: horizonC, counts };
}

/** @deprecated Use {@link computeDailyPushReminderPayload} */
export const computeReminderEmailPayload = computeDailyPushReminderPayload;

/**
 * Merge overdue-cadence send markers into state (local calendar day per bill occurrence).
 * @returns {object} patched state
 */
export function patchOverdueReminderSentLog(state, rows, ref = new Date()) {
  const todayKey = dueDateLocalKey(ref);
  const next = { ...(state ?? {}) };
  const log = { ...(next.billOverdueReminderSentAt ?? {}) };
  for (const row of rows) {
    if (!row.billId || !row.paymentKey) continue;
    if (!log[row.billId]) log[row.billId] = {};
    log[row.billId] = { ...log[row.billId], [row.paymentKey]: todayKey };
  }
  next.billOverdueReminderSentAt = log;
  return next;
}

/** Drop send-log keys for bills that are now marked paid. */
export function pruneOverdueReminderSentLog(state) {
  const log = state?.billOverdueReminderSentAt;
  if (!log || typeof log !== 'object') return state;
  const paid = state.billsPaid ?? {};
  const pruned = {};
  for (const [billId, byKey] of Object.entries(log)) {
    const paidKeys = new Set(paid[billId] ?? []);
    const kept = {};
    for (const [k, v] of Object.entries(byKey ?? {})) {
      if (!paidKeys.has(k)) kept[k] = v;
    }
    if (Object.keys(kept).length) pruned[billId] = kept;
  }
  return { ...state, billOverdueReminderSentAt: pruned };
}

