import type { EndRecurrenceRequest, EndedRecurrence } from "../../application/end-recurrence.contracts"
import type { EndRecurrenceInput } from "./dto/end-recurrence.input"
import type { EndRecurrenceType } from "./dto/end-recurrence.type"

/** Maps the GraphQL input to the command request. */
export const toEndRecurrenceRequest = (input: EndRecurrenceInput): EndRecurrenceRequest => ({
    ruleId: input.ruleId,
    endedAt: input.endedAt,
})

/** Maps the ended rule to the GraphQL type. */
export const toEndRecurrenceType = (ended: EndedRecurrence): EndRecurrenceType => ({
    ruleId: ended.ruleId,
    endedAt: ended.endedAt,
    orphanedCount: ended.orphanedCount,
})
