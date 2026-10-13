/** What bookings takes: the resource and the half-open interval to reserve. */
export interface BookingsRequest {
    /** The resource to reserve; it must belong to the caller. */
    readonly resourceId: string
    /** The inclusive beginning of the booking interval, ISO 8601. */
    readonly startsAt: string
    /** The exclusive end of the booking interval, ISO 8601. */
    readonly endsAt: string
}

/** What bookings answers: the new booking, pending until its confirmation job ran. */
export interface BookingsResult {
    /** The id of the booking. */
    readonly id: string
    /** The resource reserved by this booking. */
    readonly resourceId: string
    /** The inclusive beginning of the booking interval. */
    readonly startsAt: string
    /** The exclusive end of the booking interval. */
    readonly endsAt: string
    /** `pending` until the confirm-booking job ran, then `confirmed`. */
    readonly status: string
}
