import type { CreateCalendarResult } from "../../application/create-calendar.contracts"
import type { CreateCalendarType } from "./dto/create-calendar.type"

/** Maps the result to the GraphQL type. */
export const toCreateCalendarType = (result: CreateCalendarResult): CreateCalendarType => ({ id: result.id })
