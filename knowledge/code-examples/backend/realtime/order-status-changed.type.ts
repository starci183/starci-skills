import { Field, ObjectType } from "@nestjs/graphql"

/** The frame pushed to the client: what the buyer may see of an order status change, nothing else. */
@ObjectType()
export class OrderStatusChangedType {
    @Field()
    orderId!: string

    @Field()
    status!: string

    @Field()
    changedAt!: string
}
