import type { GetBookingStatusRequest, GetBookingStatusResult } from "../../application/get-booking-status.contracts"
import type { GetBookingStatusInput } from "./dto/get-booking-status.input"
import type { GetBookingStatusType } from "./dto/get-booking-status.type"

/** Maps the GraphQL input to the query request. */
export const toGetBookingStatusRequest = (input: GetBookingStatusInput): GetBookingStatusRequest => ({ id: input.id })

/** Maps the result to the GraphQL type. */
export const toGetBookingStatusType = (result: GetBookingStatusResult): GetBookingStatusType => ({
    id: result.id,
    status: result.status,
})
