import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The confirmation of placeOrder: the order id, the total, the payment id and whether this answer replays an earlier confirmation. */
export class PlaceOrderType {
    /** The order id. */
    @Field(() => ID)
    orderId!: string

    /** The lifecycle state. */
    @Field()
    status!: string

    /** The order total in minor units. */
    @Field(() => Int)
    totalMinorUnits!: number

    /** The currency. */
    @Field()
    currency!: string

    /** The captured payment. */
    @Field(() => ID)
    paymentId!: string

    /** True when the answer replays an earlier confirmation with the same key. */
    @Field()
    replayed!: boolean
}
