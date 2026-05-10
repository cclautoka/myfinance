/** Nearest upcoming weekday `day` (`Date.getDay()`: 0 Sun … 6 Sat) from `ref` (local). */
export function nearestWeekdayISO(day: number, ref = new Date()): string {
  const dow = ref.getDay();
  const delta = (day - dow + 7) % 7;
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function nearestThursdayISO(ref = new Date()): string {
  return nearestWeekdayISO(4, ref);
}

export function nearestFridayISO(ref = new Date()): string {
  return nearestWeekdayISO(5, ref);
}

/** True once local time is at/after noon on `payDayISO` (deposit “midday” story). */
export function localNoonOnOrBefore(payDayISO: string, ref = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDayISO.trim())) return false;
  const cutoff = new Date(`${payDayISO.trim()}T12:00:00`);
  return ref.getTime() >= cutoff.getTime();
}
