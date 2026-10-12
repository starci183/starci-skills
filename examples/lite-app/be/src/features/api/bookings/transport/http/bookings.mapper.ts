import type { BookingsRequest, BookingsResult } from "../../application/bookings.contracts"
import type { BookingsRequest as BookingsHttpRequest } from "./dto/bookings.request"
import type { BookingsResponse } from "./dto/bookings.response"

/** Maps the HTTP request to the command request. */
export const toBookingsRequest = (input: BookingsHttpRequest): BookingsRequest => ({
    resourceId: input.resourceId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
})

/** Maps the command result to the HTTP response. */
export const toBookingsResponse = (result: BookingsResult): BookingsResponse => ({
    id: result.id,
    resourceId: result.resourceId,
    startsAt: result.startsAt,
    endsAt: result.endsAt,
    status: result.status,
})
