import { Field, Int, ObjectType } from "@nestjs/graphql"
import { PageInfoType } from "./page-info.type"

@ObjectType()
/** One order as the list shows it. */
export class OrderSummaryType {
    /** The order id. */
    @Field()
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

    /** When the order was placed. */
    @Field()
    placedAt!: string
}

@ObjectType("OrderConnection")
/** One page of the caller's orders, newest first, and where the next page starts. */
export class OrdersType {
    /** The orders of this page. */
    @Field(() => [OrderSummaryType])
    items!: Array<OrderSummaryType>

    /** The cursor to continue from and whether anything follows. */
    @Field(() => PageInfoType)
    pageInfo!: PageInfoType
}
