import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The create-booking answer: the new booking, pending until its confirmation job ran. */
export class CreateBookingType {
    /** The id of the booking. */
    @Field(() => ID)
    id!: string

    /** The resource reserved by this booking. */
    @Field(() => ID)
    resourceId!: string

    /** The inclusive beginning of the booking interval. */
    @Field()
    startsAt!: string

    /** The exclusive end of the booking interval. */
    @Field()
    endsAt!: string

    /** `pending` until the confirm-booking job ran, then `confirmed`. */
    @Field()
    status!: string
}
