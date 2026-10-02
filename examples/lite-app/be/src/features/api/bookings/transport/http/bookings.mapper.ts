import type { BookingsRequest, BookingsResult } from "../../application/bookings.contracts"
import type { BookingsRequestDto } from "./dto/bookings.request"
import type { BookingsResponseDto } from "./dto/bookings.response"

/** Maps the HTTP request to the command request. */
export const toBookingsRequest = (input: BookingsRequestDto): BookingsRequest => ({ id: input.id })

/** Maps the command result to the HTTP response. */
export const toBookingsResponse = (result: BookingsResult): BookingsResponseDto => ({ id: result.id })
