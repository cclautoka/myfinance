import { describe, expect, it } from 'vitest';
import {
  businessDaysInclusiveBetween,
  businessWeekdaysFromTomorrowThroughDueInclusive,
  startOfNextCalendarDay,
  startOfLocalDay,
} from './businessDays';

describe('startOfNextCalendarDay', () => {
  it('returns local midnight of the next calendar day', () => {
    const ref = new Date(2026, 4, 12, 15, 30, 0);
    const next = startOfNextCalendarDay(ref);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(4);
    expect(next.getDate()).toBe(13);
    expect(next.getHours()).toBe(0);
  });
});

describe('businessWeekdaysFromTomorrowThroughDueInclusive', () => {
  it('counts Wed–Fri as 3 when ref is Tuesday and due is Friday', () => {
    const ref = new Date(2026, 4, 12); // Tue May 12
    const due = new Date(2026, 4, 15); // Fri May 15
    expect(businessWeekdaysFromTomorrowThroughDueInclusive(ref, due)).toBe(3);
  });

  it('returns 0 when due is on or before ref calendar day', () => {
    const ref = new Date(2026, 4, 12);
    expect(businessWeekdaysFromTomorrowThroughDueInclusive(ref, ref)).toBe(0);
    expect(businessWeekdaysFromTomorrowThroughDueInclusive(ref, new Date(2026, 4, 11))).toBe(0);
  });

  it('matches inclusive span from tomorrow for tomorrow', () => {
    const ref = new Date(2026, 4, 12);
    const due = new Date(2026, 4, 13);
    expect(businessWeekdaysFromTomorrowThroughDueInclusive(ref, due)).toBe(1);
    expect(businessDaysInclusiveBetween(startOfNextCalendarDay(ref), due)).toBe(1);
  });
});

describe('startOfLocalDay', () => {
  it('strips time', () => {
    const d = new Date(2026, 4, 12, 23, 59, 59);
    const s = startOfLocalDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getDate()).toBe(12);
  });
});
