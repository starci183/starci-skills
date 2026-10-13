import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The get-booking-status answer. */
export class GetBookingStatusType {
    /** The id of the booking. */
    @Field(() => ID)
    id!: string

    /** `pending` until the confirm-booking job ran, then `confirmed`. */
    @Field()
    status!: string
}
