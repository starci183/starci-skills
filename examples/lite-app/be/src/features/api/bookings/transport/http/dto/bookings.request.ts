import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of bookings. */
export class BookingsRequest {
    /** The id of the subject. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
