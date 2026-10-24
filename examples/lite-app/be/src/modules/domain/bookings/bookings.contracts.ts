/** What a new booking takes: the resource and the half-open interval it reserves. */
export interface CreateBookingParams {
    /** The resource to reserve; it must belong to the caller. */
    readonly resourceId: string
    /** The inclusive beginning of the interval, ISO 8601. */
    readonly startsAt: string
    /** The exclusive end of the interval, ISO 8601. */
    readonly endsAt: string
}

/** The confirmation status of one booking: what a caller polls after booking. */
export interface BookingStatusResult {
    /** The booking id. */
    readonly id: string
    /** `pending` until the confirm-booking job ran, then `confirmed`. */
    readonly status: string
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

/** The push of one booking status change to its owner; `id` is the domain event id, the resume point of `Last-Event-ID`. */
export interface BookingStatusFrame {
    /** The domain event id, `<booking id>:<status>`: unique per booking and status, so a replayed job pushes the same id. */
    readonly id: string
    /** The booking that changed. */
    readonly bookingId: string
    /** The new status. */
    readonly status: string
}
