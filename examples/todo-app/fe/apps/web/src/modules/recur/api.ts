import { isRecord, parseOutcome, request, type Outcome } from "@/modules/api"
import type { UpcomingOccurrences } from "@/modules/types"

/**
 * The recurrence capability's named GraphQL calls (fr.recur.make-recurring, fr.recur.see-upcoming and
 * fr.recur.end), reached through the app's one transport client. Each returns the client's `Outcome`,
 * so a refusal reaches the schedule's own refused state as a kind rather than as an exception.
 */

/** What makeRecurring answers with: the created rule's identity and its settled schedule. */
type MadeRule = {
    readonly ruleId: string
    readonly title: string
    readonly frequency: string
    readonly timeZone: string
    readonly time: string
    readonly startDate: string
}

/** The wire shape makeRecurring accepts; the frequency travels under its GraphQL enum literal. */
type MakeRecurringInput = {
    readonly title: string
    readonly frequency: string
    readonly n?: number
    readonly dayOfMonth?: number
    readonly timeZone: string
    readonly time: string
    readonly startDate: string
}

/** What endRecurrence answers with: the date the rule settled on and how many occurrences it orphaned. */
type EndedRule = {
    readonly ruleId: string
    readonly endedAt: string
    readonly orphanedCount: number
}

/** The made rule of a payload, or `null` when the payload is not that shape. */
const toMadeRule = (data: unknown): MadeRule | null =>
    isRecord(data) &&
    typeof data.ruleId === "string" &&
    typeof data.title === "string" &&
    typeof data.frequency === "string" &&
    typeof data.timeZone === "string" &&
    typeof data.time === "string" &&
    typeof data.startDate === "string"
        ? {
              ruleId: data.ruleId,
              title: data.title,
              frequency: data.frequency,
              timeZone: data.timeZone,
              time: data.time,
              startDate: data.startDate,
          }
        : null

/** The ended rule of a payload, or `null` when the payload is not that shape. */
const toEndedRule = (data: unknown): EndedRule | null =>
    isRecord(data) &&
    typeof data.ruleId === "string" &&
    typeof data.endedAt === "string" &&
    typeof data.orphanedCount === "number"
        ? { ruleId: data.ruleId, endedAt: data.endedAt, orphanedCount: data.orphanedCount }
        : null

/** One stored occurrence row of the wire, or `null` when the row is not that shape. */
const toOccurrence = (row: unknown): UpcomingOccurrences["materialised"][number] | null =>
    isRecord(row) &&
    typeof row.occurrenceId === "string" &&
    typeof row.localDate === "string" &&
    typeof row.status === "string"
        ? { occurrenceId: row.occurrenceId, localDate: row.localDate, status: row.status }
        : null

/** The stored rows and the live preview of a payload, or `null` when the payload is not that shape. */
const toUpcoming = (data: unknown): UpcomingOccurrences | null => {
    if (!isRecord(data) || !Array.isArray(data.materialised) || !Array.isArray(data.previewDates)) return null
    const materialised = data.materialised.map(toOccurrence)
    const previewDates = data.previewDates.filter((date): date is string => typeof date === "string")
    return materialised.every((row) => row !== null) ? { materialised, previewDates } : null
}

/** Creates one recurrence rule from a task's title. */
export const makeRecurring = async (token: string | null, input: MakeRecurringInput): Promise<Outcome<MadeRule>> =>
    parseOutcome(await request({ operation: "MakeRecurring", variables: { input }, token }), toMadeRule)

/** Reads a rule's stored occurrences and its live-computed preview. */
export const readUpcomingOccurrences = async (
    token: string | null,
    ruleId: string,
): Promise<Outcome<UpcomingOccurrences>> =>
    parseOutcome(await request({ operation: "UpcomingOccurrences", variables: { ruleId }, token }), toUpcoming)

/** Ends a rule on the given local date; the answer carries the date it settled on. */
export const endRecurrence = async (
    token: string | null,
    ruleId: string,
    endedAt: string,
): Promise<Outcome<EndedRule>> =>
    parseOutcome(
        await request({ operation: "EndRecurrence", variables: { input: { ruleId, endedAt } }, token }),
        toEndedRule,
    )
