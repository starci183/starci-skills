/** What a new booking takes: the resource and the half-open interval it reserves. */
export interface CreateBookingParams {
    /** The resource to reserve; it must belong to the caller. */
    readonly resourceId: string
    /** The inclusive beginning of the interval, ISO 8601. */
    readonly startsAt: string
    /** The exclusive end of the interval, ISO 8601. */
    readonly endsAt: string
}

/** One booking as the capability answers it. */
export interface BookingResult {
    /** The booking id. */
    readonly id: string
    /** The reserved resource. */
    readonly resourceId: string
    /** The inclusive beginning of the interval. */
    readonly startsAt: string
    /** The exclusive end of the interval. */
    readonly endsAt: string
    /** `pending` until the confirm-booking job ran, then `confirmed`. */
    readonly status: string
}
