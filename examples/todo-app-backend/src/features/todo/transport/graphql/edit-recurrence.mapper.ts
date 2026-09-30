import type { EditRecurrenceRequest, EditedRecurrence } from "../../application/edit-recurrence.contracts"
import type { EditRecurrenceInput } from "./dto/edit-recurrence.input"
import type { EditRecurrenceType } from "./dto/edit-recurrence.type"

/** Maps the GraphQL input to the command request; an absent field stays absent, so it keeps its value. */
export const toEditRecurrenceRequest = (input: EditRecurrenceInput): EditRecurrenceRequest => ({
    ruleId: input.ruleId,
    frequency: input.frequency,
    n: input.n,
    dayOfMonth: input.dayOfMonth,
    timeZone: input.timeZone,
    time: input.time,
})

/** Maps the edited rule to the GraphQL type. */
export const toEditRecurrenceType = (edited: EditedRecurrence): EditRecurrenceType => ({
    ruleId: edited.ruleId,
    frequency: edited.frequency,
    timeZone: edited.timeZone,
    time: edited.time,
})
