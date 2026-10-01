import type { CompleteOccurrenceRequest, CompletedOccurrence } from "../../application/complete-occurrence.contracts"
import type { CompleteOccurrenceInput } from "./dto/complete-occurrence.input"
import type { CompleteOccurrenceType } from "./dto/complete-occurrence.type"

/** Maps the GraphQL input to the command request. */
export const toCompleteOccurrenceRequest = (input: CompleteOccurrenceInput): CompleteOccurrenceRequest => ({
    occurrenceId: input.occurrenceId,
})

/** Maps the completed occurrence to the GraphQL type. */
export const toCompleteOccurrenceType = (completed: CompletedOccurrence): CompleteOccurrenceType => ({
    occurrenceId: completed.occurrenceId,
    status: completed.status,
})
