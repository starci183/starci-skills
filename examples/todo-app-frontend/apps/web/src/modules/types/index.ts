/**
 * The shared shapes with no runtime behaviour: what a task, a collaborator and a recurrence rule look
 * like wherever they travel - the transport that reads them, the hooks that hold them and the
 * components that draw them.
 */

/** The one shape a task takes on the wire and in every product-facing list. */
export interface Task {
    readonly id: string
    readonly title: string
    readonly complete: boolean
}

/** br.share.role.permissions: a collaborator is a viewer or an editor, never anything else. */
export type ShareRole = "viewer" | "editor"

/** The one shape a collaborator row takes on the wire and in the collaborator list. `status` is
 * sds.share.invitation-lifecycle's live status fr.share.list returns, recomputed on every read. */
export interface Collaborator {
    readonly id: string
    readonly email: string
    readonly role: ShareRole
    readonly status: "pending" | "accepted" | "expired" | "revoked"
}

/** data.recur.rule.frequency's three values, in the direction's radio order. */
export type RecurFrequency = "every-weekday" | "every-n-days" | "monthly-day"

/** The fields the refused state can name; 'form' is the whole submission, not one input. */
export type ScheduleField = "n" | "dayOfMonth" | "time" | "timeZone" | "startDate" | "form"

/** A refused submission: which field needs attention and the sentence that says why. */
export type ScheduleRefusal = {
    readonly field: ScheduleField
    readonly message: string
}

/** The rule the schedule screen created and may end; endedAt is null while the rule is active. */
export type RecurRule = {
    readonly ruleId: string
    readonly title: string
    readonly frequency: RecurFrequency
    readonly n: number | null
    readonly dayOfMonth: number | null
    readonly time: string
    readonly timeZone: string
    readonly startDate: string
    readonly endedAt: string | null
}

/** One materialised occurrence row from upcomingOccurrences. */
type MaterialisedOccurrence = {
    readonly occurrenceId: string
    readonly localDate: string
    readonly status: string
}

/** fr.recur.see-upcoming's read shape: stored rows plus a live-computed preview. */
export type UpcomingOccurrences = {
    readonly materialised: ReadonlyArray<MaterialisedOccurrence>
    readonly previewDates: ReadonlyArray<string>
}
