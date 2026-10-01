import type { RecurErrorCode } from "@modules/domain/recur"
import type { Outcome } from "@modules/platform/primitives"

/** What completing an occurrence takes: its id, which is the id of the task it spawned. */
export interface CompleteOccurrenceRequest {
    /** The occurrence id. */
    readonly occurrenceId: string
}

/** The occurrence after the transition. */
export interface CompletedOccurrence {
    /** The occurrence id. */
    readonly occurrenceId: string
    /** The occurrence status afterwards. */
    readonly status: string
}

/** The occurrence after the transition, or the refusal that names why it was not touched. */
export type CompleteOccurrenceResult = Outcome<CompletedOccurrence, RecurErrorCode>
