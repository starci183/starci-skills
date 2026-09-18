/**
 * br.recur.impossible-date.skips + the frequency half of sds.recur.generation-engine: walks a rule's
 * real calendar dates one by one and selects the ones it fires on. A monthly-day rule whose day does not
 * exist in a given month (decision.recur.impossible-date: skip) simply never produces a candidate date
 * for that month - the skip is a consequence of walking real calendar days with `Date.UTC`'s own
 * calendar arithmetic, not a special case layered on top of it (this is exactly what that decision's
 * `recommendationReason` asks for).
 */

export type RuleFrequency = 'every-weekday' | 'every-n-days' | 'monthly-day';

export interface CalendarRuleShape {
  readonly frequency: RuleFrequency;
  readonly n: number | null;
  readonly dayOfMonth: number | null;
  readonly startDate: string; // YYYY-MM-DD
}

function toIsoDate(year: number, monthIndex0: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex0, day));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(date: string): { year: number; monthIndex0: number; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y, monthIndex0: m - 1, day: d };
}

/** The real calendar day-of-week for an ISO date, 0=Sunday..6=Saturday, computed off `Date.UTC` so no
 * host time zone or DST rule ever perturbs which weekday a calendar date falls on. */
function weekdayOf(date: string): number {
  const { year, monthIndex0, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, monthIndex0, day)).getUTCDay();
}

function addDays(date: string, days: number): string {
  const { year, monthIndex0, day } = parseIsoDate(date);
  return toIsoDate(year, monthIndex0, day + days);
}

function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  const aMs = Date.UTC(a.year, a.monthIndex0, a.day);
  const bMs = Date.UTC(b.year, b.monthIndex0, b.day);
  return Math.round((bMs - aMs) / (24 * 60 * 60 * 1000));
}

/** True when `date`'s real calendar day is exactly the rule's `dayOfMonth` - false, never substituted,
 * for every month that day does not have (decision.recur.impossible-date: skip). */
function isMonthlyDayMatch(date: string, dayOfMonth: number): boolean {
  const { day } = parseIsoDate(date);
  return day === dayOfMonth;
}

function fires(rule: CalendarRuleShape, date: string): boolean {
  switch (rule.frequency) {
    case 'every-weekday': {
      const weekday = weekdayOf(date);
      return weekday >= 1 && weekday <= 5;
    }
    case 'every-n-days': {
      const n = rule.n ?? 1;
      const elapsed = daysBetween(rule.startDate, date);
      return elapsed >= 0 && elapsed % n === 0;
    }
    case 'monthly-day': {
      const dayOfMonth = rule.dayOfMonth ?? 1;
      return isMonthlyDayMatch(date, dayOfMonth);
    }
    default:
      return false;
  }
}

/**
 * Every real calendar date in `[fromInclusive, toInclusive]` (both YYYY-MM-DD, both in the rule's own
 * time zone) the rule fires on, walked one real day at a time. Dates before the rule's own `startDate`
 * are never included, matching data.recur.rule's invariant that a rule never has an occurrence dated
 * before it began.
 */
export function datesForRule(rule: CalendarRuleShape, fromInclusive: string, toInclusive: string): string[] {
  const start = rule.startDate > fromInclusive ? rule.startDate : fromInclusive;
  if (start > toInclusive) return [];
  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  const maxIterations = daysBetween(start, toInclusive) + 1;
  while (cursor <= toInclusive && guard <= maxIterations) {
    if (fires(rule, cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

export { addDays, daysBetween };
