import { IsNotEmpty, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request of bookings. */
export class BookingsRequest {
    /** The id of the subject. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    id!: string
}
