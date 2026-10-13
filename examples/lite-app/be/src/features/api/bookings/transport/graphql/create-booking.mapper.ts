import type { CreateBookingRequest, CreateBookingResult } from "../../application/create-booking.contracts"
import type { CreateBookingInput } from "./dto/create-booking.input"
import type { CreateBookingType } from "./dto/create-booking.type"

/** Maps the GraphQL input to the command request. */
export const toCreateBookingRequest = (input: CreateBookingInput): CreateBookingRequest => ({
    resourceId: input.resourceId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
})

/** Maps the result to the GraphQL type. */
export const toCreateBookingType = (result: CreateBookingResult): CreateBookingType => ({
    id: result.id,
    resourceId: result.resourceId,
    startsAt: result.startsAt,
    endsAt: result.endsAt,
    status: result.status,
})
