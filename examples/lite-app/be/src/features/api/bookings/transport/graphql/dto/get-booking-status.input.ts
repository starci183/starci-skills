import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The get-booking-status arguments: the id of the booking. */
export class GetBookingStatusInput {
    /** The id of the booking. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
