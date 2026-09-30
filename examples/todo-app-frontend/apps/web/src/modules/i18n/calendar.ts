/**
 * The two calendar answers the recurrence screen needs that `next-intl` does not give: the reader's own
 * IANA time zone, and the local calendar date in a named zone shaped YYYY-MM-DD (the wire format of
 * `endRecurrence` and `makeRecurring`, which is a date, not display text). Formatters are configured here
 * and nowhere else.
 */

/** The IANA time zone the reader's device runs in. */
export const localTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The local calendar date in the given zone, shaped YYYY-MM-DD. */
export const todayInZone = (timeZone: string): string => {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date())
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ""
    return `${part("year")}-${part("month")}-${part("day")}`
}
