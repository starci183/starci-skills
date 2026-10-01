import type { RecurErrorCode } from "@modules/domain/recur"
import type { Outcome } from "@modules/platform/primitives"

/** What ending a recurrence rule takes. */
export interface EndRecurrenceRequest {
    /** The rule id. */
    readonly ruleId: string
    /** The local date (YYYY-MM-DD, in the zone of the rule) the rule ends on. */
    readonly endedAt: string
}

/** The rule after it ended. */
export interface EndedRecurrence {
    /** The rule id. */
    readonly ruleId: string
    /** The local date the rule ended on. */
    readonly endedAt: string
    /** How many occurrences the end orphaned. */
    readonly orphanedCount: number
}

/** The ended rule, or the refusal that names why it was not touched. */
export type EndRecurrenceResult = Outcome<EndedRecurrence, RecurErrorCode>
