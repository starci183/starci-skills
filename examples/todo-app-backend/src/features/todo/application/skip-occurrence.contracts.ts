import type { RecurErrorCode } from "@modules/domain/recur"
import type { Outcome } from "@modules/platform/primitives"

/** What skipping an occurrence takes: its id, which is the id of the task it spawned. */
export interface SkipOccurrenceRequest {
    /** The occurrence id. */
    readonly occurrenceId: string
}

/** The occurrence after the transition. */
export interface SkippedOccurrence {
    /** The occurrence id. */
    readonly occurrenceId: string
    /** The occurrence status afterwards. */
    readonly status: string
}

/** The occurrence after the transition, or the refusal that names why it was not touched. */
export type SkipOccurrenceResult = Outcome<SkippedOccurrence, RecurErrorCode>
