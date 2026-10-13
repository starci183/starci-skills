/** What get-booking-status takes. */
export interface GetBookingStatusRequest {
    /** The id of the booking. */
    readonly id: string
}

/** What get-booking-status answers: whether the confirm-booking job of the booking ran. */
export interface GetBookingStatusResult {
    /** The id of the booking. */
    readonly id: string
    /** `pending` until the confirm-booking job ran, then `confirmed`. */
    readonly status: string
}
