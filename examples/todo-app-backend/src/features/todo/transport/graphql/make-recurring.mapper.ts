import type { MadeRecurring, MakeRecurringRequest } from "../../application/make-recurring.contracts"
import type { MakeRecurringInput } from "./dto/make-recurring.input"
import type { MakeRecurringType } from "./dto/make-recurring.type"

/** Maps the GraphQL input to the command request; an absent n or dayOfMonth becomes null. */
export const toMakeRecurringRequest = (input: MakeRecurringInput): MakeRecurringRequest => ({
    title: input.title,
    frequency: input.frequency,
    n: input.n ?? null,
    dayOfMonth: input.dayOfMonth ?? null,
    timeZone: input.timeZone,
    time: input.time,
    startDate: input.startDate,
})

/** Maps the created rule to the GraphQL type. */
export const toMakeRecurringType = (made: MadeRecurring): MakeRecurringType => ({
    ruleId: made.ruleId,
    title: made.title,
    frequency: made.frequency,
    timeZone: made.timeZone,
    time: made.time,
    startDate: made.startDate,
})
