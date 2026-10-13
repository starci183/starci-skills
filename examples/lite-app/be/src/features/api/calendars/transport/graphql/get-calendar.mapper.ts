import type { GetCalendarRequest, GetCalendarResult } from "../../application/get-calendar.contracts"
import type { GetCalendarInput } from "./dto/get-calendar.input"
import type { GetCalendarType } from "./dto/get-calendar.type"

/** Maps the GraphQL input to the query request. */
export const toGetCalendarRequest = (input: GetCalendarInput): GetCalendarRequest => ({ id: input.id })

/** Maps the result to the GraphQL type. */
export const toGetCalendarType = (result: GetCalendarResult): GetCalendarType => ({ id: result.id })
