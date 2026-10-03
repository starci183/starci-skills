/** What bookings takes. */
export interface BookingsRequest {
    /** The id of the subject. */
    readonly id: string
}

/** What bookings answers. */
export interface BookingsResult {
    /** The id of the subject. */
    readonly id: string
    /** The resource reserved by this booking. */
    readonly resourceId: string
    /** The inclusive beginning of the booking interval. */
    readonly startsAt: string
    /** The exclusive end of the booking interval. */
    readonly endsAt: string
}
