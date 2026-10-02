import { IsNotEmpty, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request of bookings. */
export class BookingsRequestDto {
    /** The id of the subject. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    id!: string
}
