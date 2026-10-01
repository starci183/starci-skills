import type { LocalDateTime, ZoneResolution } from "./recur.contracts"

const MINUTE_MS = 60_000

/** Formats a UTC instant into its wall-clock parts in `timeZone`. */
const zonedParts = (utcMs: number, timeZone: string): LocalDateTime => {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
    const fields = new Map<string, number>()
    for (const part of formatter.formatToParts(new Date(utcMs))) {
        if (part.type !== "literal") fields.set(part.type, Number(part.value))
    }
    return {
        year: fields.get("year") ?? 0,
        month: fields.get("month") ?? 0,
        day: fields.get("day") ?? 0,
        hour: (fields.get("hour") ?? 0) % 24,
        minute: fields.get("minute") ?? 0,
    }
}

/** The UTC offset in minutes such that `wallClock = utc + offset`, at the given real instant. */
const offsetMinutesAt = (utcMs: number, timeZone: string): number => {
    const wall = zonedParts(utcMs, timeZone)
    const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0)
    return Math.round((asUtc - utcMs) / MINUTE_MS)
}

/** The offset genuinely in effect at a naive guess, refined once so the guess converges onto the real regime at that instant. */
const refinedOffsetMinutes = (naiveGuessMs: number, timeZone: string): number => {
    const first = offsetMinutesAt(naiveGuessMs, timeZone)
    return offsetMinutesAt(naiveGuessMs - first * MINUTE_MS, timeZone)
}

const sameWallClock = (a: LocalDateTime, b: LocalDateTime): boolean =>
    a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute

/**
 * Resolves a nominal local date and time in `timeZone` to the real UTC instant it means, from the zone of the owner and
 * never a fixed offset. The offsets at the start and the end of the local day are sampled separately; when they agree the
 * time resolves directly. When they differ a transition happens that day: a time both offsets map back to is a fold and
 * takes the earlier instant; a time neither maps back to is a gap and is shifted forward by the size of the gap.
 */
export const resolveLocalTimeToUtc = (timeZone: string, local: LocalDateTime): ZoneResolution => {
    const offsetStart = refinedOffsetMinutes(Date.UTC(local.year, local.month - 1, local.day, 0, 0, 0), timeZone)
    const offsetEnd = refinedOffsetMinutes(Date.UTC(local.year, local.month - 1, local.day, 23, 59, 0), timeZone)
    const naiveNominal = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0)
    if (offsetStart === offsetEnd) return { instant: new Date(naiveNominal - offsetStart * MINUTE_MS), kind: "normal" }

    const underStart = naiveNominal - offsetStart * MINUTE_MS
    const underEnd = naiveNominal - offsetEnd * MINUTE_MS
    const matchesStart = sameWallClock(zonedParts(underStart, timeZone), local)
    const matchesEnd = sameWallClock(zonedParts(underEnd, timeZone), local)
    if (matchesStart && matchesEnd) return { instant: new Date(Math.min(underStart, underEnd)), kind: "fold" }
    if (matchesStart) return { instant: new Date(underStart), kind: "normal" }
    if (matchesEnd) return { instant: new Date(underEnd), kind: "normal" }
    return { instant: new Date(underStart), kind: "gap" }
}

/** Resolves the `time` (HH:MM) of a rule on `localDate` (YYYY-MM-DD) in `timeZone` to a UTC instant. */
export const resolveRuleInstant = (timeZone: string, localDate: string, time: string): ZoneResolution => {
    const [year = 0, month = 1, day = 1] = localDate.split("-").map(Number)
    const [hour = 0, minute = 0] = time.split(":").map(Number)
    return resolveLocalTimeToUtc(timeZone, { year, month, day, hour, minute })
}

/** The real calendar date (YYYY-MM-DD) in `timeZone` that `instant` falls on: "today" in the zone of the rule, never the host date. */
export const localDateInZone = (timeZone: string, instant: Date): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
