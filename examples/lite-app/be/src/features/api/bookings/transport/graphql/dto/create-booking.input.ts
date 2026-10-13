import { Field, ID, InputType } from "@nestjs/graphql"
import { IsISO8601, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The create-booking arguments: the resource and the half-open interval to reserve. */
export class CreateBookingInput {
    /** The resource to reserve. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    resourceId!: string

    /** The inclusive beginning of the booking interval, ISO 8601. */
    @Field()
    @IsISO8601({ strict: true })
    @MaxLength(40)
    startsAt!: string

    /** The exclusive end of the booking interval, ISO 8601. */
    @Field()
    @IsISO8601({ strict: true })
    @MaxLength(40)
    endsAt!: string
}
