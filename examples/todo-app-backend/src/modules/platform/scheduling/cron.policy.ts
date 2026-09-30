/** The parsed fields of a cron expression: the values each field admits. */
export interface CronFields {
    /** Minutes, 0 to 59. */
    readonly minute: ReadonlySet<number>
    /** Hours, 0 to 23. */
    readonly hour: ReadonlySet<number>
    /** Days of the month, 1 to 31. */
    readonly dayOfMonth: ReadonlySet<number>
    /** Months, 1 to 12. */
    readonly month: ReadonlySet<number>
    /** Days of the week, 0 (Sunday) to 6. */
    readonly dayOfWeek: ReadonlySet<number>
}

const STEP_PATTERN = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/

const parsePart = (part: string, min: number, max: number): Array<number> | null => {
    const match = STEP_PATTERN.exec(part)
    if (!match?.[1]) return null
    const step = match[2] === undefined ? 1 : Number(match[2])
    if (step < 1) return null
    const [from, to] = rangeOf(match[1], match[2] !== undefined, min, max)
    if (Number.isNaN(from) || Number.isNaN(to) || from < min || to > max || from > to) return null
    const values: Array<number> = []
    for (let value = from; value <= to; value += step) values.push(value)
    return values
}

const rangeOf = (text: string, stepped: boolean, min: number, max: number): [number, number] => {
    if (text === "*") return [min, max]
    const [start, end] = text.split("-").map(Number)
    if (start === undefined) return [Number.NaN, Number.NaN]
    return [start, end ?? (stepped ? max : start)]
}

const parseField = (text: string, min: number, max: number): Set<number> | null => {
    const values = new Set<number>()
    for (const part of text.split(",")) {
        const parsed = parsePart(part, min, max)
        if (parsed === null) return null
        for (const value of parsed) values.add(value)
    }
    return values
}

/** Parses a five-field cron expression (lists, ranges, steps and `*`); null when it is not valid. */
export const parseCron = (expression: string): CronFields | null => {
    const parts = expression.trim().split(/\s+/)
    const [minuteText, hourText, dayText, monthText, weekdayText] = parts
    if (parts.length !== 5 || !minuteText || !hourText || !dayText || !monthText || !weekdayText) return null
    const minute = parseField(minuteText, 0, 59)
    const hour = parseField(hourText, 0, 23)
    const dayOfMonth = parseField(dayText, 1, 31)
    const month = parseField(monthText, 1, 12)
    const dayOfWeek = parseField(weekdayText, 0, 6)
    if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return null
    return { minute, hour, dayOfMonth, month, dayOfWeek }
}

/** True when the minute containing `at` (in UTC) is one the expression admits. */
export const cronMatches = (fields: CronFields, at: Date): boolean =>
    fields.minute.has(at.getUTCMinutes()) &&
    fields.hour.has(at.getUTCHours()) &&
    fields.dayOfMonth.has(at.getUTCDate()) &&
    fields.month.has(at.getUTCMonth() + 1) &&
    fields.dayOfWeek.has(at.getUTCDay())
