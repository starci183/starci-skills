import { RuleFrequency } from "./recur.contracts"
import type { CalendarRuleShape, RuleShapeProblem } from "./recur.contracts"

const DAY_MS = 24 * 60 * 60 * 1000

interface IsoDateParts {
    readonly year: number
    readonly monthIndex0: number
    readonly day: number
}

const toIsoDate = (year: number, monthIndex0: number, day: number): string => {
    const date = new Date(Date.UTC(year, monthIndex0, day))
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    const dayOfMonth = String(date.getUTCDate()).padStart(2, "0")
    return `${date.getUTCFullYear()}-${month}-${dayOfMonth}`
}

const parseIsoDate = (date: string): IsoDateParts => {
    const [year = 0, month = 1, day = 1] = date.split("-").map(Number)
    return { year, monthIndex0: month - 1, day }
}

/** The real calendar weekday of an ISO date, 0 Sunday to 6 Saturday, computed off `Date.UTC` so no host zone or DST rule perturbs it. */
const weekdayOf = (date: string): number => {
    const { year, monthIndex0, day } = parseIsoDate(date)
    return new Date(Date.UTC(year, monthIndex0, day)).getUTCDay()
}

/** The ISO date `days` after `date`, computed on the real calendar. */
export const addDays = (date: string, days: number): string => {
    const { year, monthIndex0, day } = parseIsoDate(date)
    return toIsoDate(year, monthIndex0, day + days)
}

/** The number of whole days from `from` to `to`, both ISO dates. */
export const daysBetween = (from: string, to: string): number => {
    const a = parseIsoDate(from)
    const b = parseIsoDate(to)
    return Math.round((Date.UTC(b.year, b.monthIndex0, b.day) - Date.UTC(a.year, a.monthIndex0, a.day)) / DAY_MS)
}

const fires = (rule: CalendarRuleShape, date: string): boolean => {
    switch (rule.frequency) {
        case RuleFrequency.EveryWeekday: {
            const weekday = weekdayOf(date)
            return weekday >= 1 && weekday <= 5
        }
        case RuleFrequency.EveryNDays: {
            const elapsed = daysBetween(rule.startDate, date)
            return elapsed >= 0 && elapsed % (rule.n ?? 1) === 0
        }
        case RuleFrequency.MonthlyDay:
            // A day that a month lacks never matches, so the month is skipped: no clamping to the last day.
            return parseIsoDate(date).day === (rule.dayOfMonth ?? 1)
    }
}

/**
 * Every real calendar date in `[fromInclusive, toInclusive]` (both YYYY-MM-DD, in the zone of the rule) the rule fires on,
 * walked one real day at a time. Dates before the rule start date are never included.
 */
export const datesForRule = (rule: CalendarRuleShape, fromInclusive: string, toInclusive: string): Array<string> => {
    const start = rule.startDate > fromInclusive ? rule.startDate : fromInclusive
    if (start > toInclusive) return []
    const dates: Array<string> = []
    const last = daysBetween(start, toInclusive)
    for (let offset = 0; offset <= last; offset += 1) {
        const date = addDays(start, offset)
        if (fires(rule, date)) dates.push(date)
    }
    return dates
}

const isPositiveInteger = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isInteger(value) && value > 0

/**
 * The shape check of a rule: `n` is required (a positive integer) and only present for every-n-days, `dayOfMonth` is
 * required (1 to 31) and only present for monthly-day. It never refuses a day some months lack: that is skipped at generation.
 * Answers null when the shape is valid.
 */
export const shapeProblemOf = (
    frequency: RuleFrequency,
    n: number | null | undefined,
    dayOfMonth: number | null | undefined,
): RuleShapeProblem | null => {
    const hasN = n !== null && n !== undefined
    const hasDay = dayOfMonth !== null && dayOfMonth !== undefined
    switch (frequency) {
        case RuleFrequency.EveryNDays:
            if (!isPositiveInteger(n)) return "n-required"
            return hasDay ? "day-of-month-forbidden" : null
        case RuleFrequency.MonthlyDay:
            if (!isPositiveInteger(dayOfMonth) || dayOfMonth > 31) return "day-of-month-required"
            return hasN ? "n-forbidden" : null
        case RuleFrequency.EveryWeekday:
            if (hasN) return "n-forbidden"
            return hasDay ? "day-of-month-forbidden" : null
    }
}
