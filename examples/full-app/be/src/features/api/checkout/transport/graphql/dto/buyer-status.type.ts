import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Whether the caller has confirmed orders. */
export class BuyerStatusType {
    /** The person the bearer token authenticates. */
    @Field(() => ID)
    personId!: string

    /** True when the person has confirmed orders. */
    @Field()
    hasOrders!: boolean
}
