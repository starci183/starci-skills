import type { RecurErrorCode } from "@modules/domain/recur"
import type { Outcome } from "@modules/platform/primitives"

/** What reading the upcoming occurrences of a rule takes. */
export interface UpcomingOccurrencesRequest {
    /** The rule id. */
    readonly ruleId: string
    /** How many days ahead, from today in the zone of the rule, the live preview looks; 14 when absent. */
    readonly previewDays?: number
}

/** One occurrence already materialised. */
export interface MaterialisedOccurrenceSummary {
    /** The occurrence id, the same as the id of the task it spawned. */
    readonly occurrenceId: string
    /** The local date it is due on. */
    readonly localDate: string
    /** The instant it is due at, as an ISO string. */
    readonly dueAtUtc: string
    /** The lifecycle state. */
    readonly status: string
}

/** The occurrence picture of one rule. */
export interface UpcomingOccurrences {
    /** The rule id. */
    readonly ruleId: string
    /** Every occurrence already materialised for the rule, with its status. */
    readonly materialised: Array<MaterialisedOccurrenceSummary>
    /** The dates the rule will next fire on, computed live and never a promise that a row exists; empty for an ended rule. */
    readonly previewDates: Array<string>
}

/** The occurrence picture, or the refusal that names why it was not read. */
export type UpcomingOccurrencesResult = Outcome<UpcomingOccurrences, RecurErrorCode>
