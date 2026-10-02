import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One push of an order's status: what the buyer may see of a change, nothing else. */
export class OrderStatusChangedType {
    /** The order. */
    @Field()
    orderId!: string

    /** The state the order is in now. */
    @Field()
    status!: string

    /** When the order entered that state, ISO 8601. */
    @Field()
    changedAt!: string
}
