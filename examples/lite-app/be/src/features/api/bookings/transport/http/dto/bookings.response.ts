/** The HTTP response of bookings. */
export class BookingsResponse {
    /** The id of the subject. */
    id!: string
    /** The resource reserved by this booking. */
    resourceId!: string
    /** The inclusive beginning of the booking interval. */
    startsAt!: string
    /** The exclusive end of the booking interval. */
    endsAt!: string
}
