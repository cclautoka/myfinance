const MS_DAY = 86400_000;

/** Local midnight for date-only arithmetic (no TZ shift). */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

/**
 * Whole calendar days from `due` → `ref` on the timeline (same calendar day = 0;
 * next calendar day after due = 1).
 */
export function calendarDaysAfterDue(ref: Date, due: Date): number {
  const a = startOfLocalDay(ref).getTime();
  const b = startOfLocalDay(due).getTime();
  return Math.floor((a - b) / MS_DAY);
}

/** Number of Mon–Fri calendar days from `from` through `to` inclusive. */
export function businessDaysInclusiveBetween(from: Date, to: Date): number {
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

/** Calendar day after `ref` at local midnight (used for “lead” windows that should not count today). */
export function startOfNextCalendarDay(ref: Date): Date {
  const d = startOfLocalDay(ref);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Weekdays from **tomorrow** (first calendar day after `ref`) through `due` inclusive.
 * Returns 0 if `due` is on or before `ref`’s calendar day (caller should handle due-today / past-due separately).
 */
export function businessWeekdaysFromTomorrowThroughDueInclusive(ref: Date, due: Date): number {
  const dueStart = startOfLocalDay(due);
  const refStart = startOfLocalDay(ref);
  if (dueStart.getTime() <= refStart.getTime()) return 0;
  return businessDaysInclusiveBetween(startOfNextCalendarDay(ref), due);
}
