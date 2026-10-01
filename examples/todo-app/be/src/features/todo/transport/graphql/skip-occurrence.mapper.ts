import type { SkipOccurrenceRequest, SkippedOccurrence } from "../../application/skip-occurrence.contracts"
import type { SkipOccurrenceInput } from "./dto/skip-occurrence.input"
import type { SkipOccurrenceType } from "./dto/skip-occurrence.type"

/** Maps the GraphQL input to the command request. */
export const toSkipOccurrenceRequest = (input: SkipOccurrenceInput): SkipOccurrenceRequest => ({
    occurrenceId: input.occurrenceId,
})

/** Maps the skipped occurrence to the GraphQL type. */
export const toSkipOccurrenceType = (skipped: SkippedOccurrence): SkipOccurrenceType => ({
    occurrenceId: skipped.occurrenceId,
    status: skipped.status,
})
