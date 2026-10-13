import { IsISO8601, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of bookings: the resource and the half-open interval to reserve. */
export class BookingsRequest {
    /** The resource to reserve. */
    @IsUUID("4")
    @MaxLength(36)
    resourceId!: string

    /** The inclusive beginning of the booking interval, ISO 8601. */
    @IsISO8601({ strict: true })
    @MaxLength(40)
    startsAt!: string

    /** The exclusive end of the booking interval, ISO 8601. */
    @IsISO8601({ strict: true })
    @MaxLength(40)
    endsAt!: string
}
