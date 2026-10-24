import type { RealtimeTopic } from "@modules/platform/realtime"
import type { BookingStatusFrame } from "./bookings.contracts"

/** True when a value is a push of the booking status channel: the event id, the booking and its new status. */
export const isBookingStatusFrame = (value: unknown): value is BookingStatusFrame =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "bookingId" in value &&
    typeof value.bookingId === "string" &&
    "status" in value &&
    typeof value.status === "string"

/** The frame that tells an owner a booking reached a status; its id names the booking and the status, so a repeated job pushes the same id. */
export const bookingStatusFrame = (bookingId: string, status: string): BookingStatusFrame => ({
    id: `${bookingId}:${status}`,
    bookingId,
    status,
})

/**
 * The channel of one owner's bookings. The owner is part of the name, so a subscription built from another principal can never
 * receive these frames; the SSE door and the confirm-booking write both build the topic with this one function.
 */
export const bookingStatusTopic = (ownerId: string): RealtimeTopic<BookingStatusFrame> => ({
    name: `booking-status:${ownerId}`,
    accepts: isBookingStatusFrame,
})
