import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of downgradePlan: the subscription and its plan and status after the downgrade. */
export class DowngradePlanType {
    /** The subscription of the caller. */
    @Field(() => ID)
    subscriptionId!: string

    /** The plan the subscription holds afterwards. */
    @Field()
    plan!: string

    /** The subscription status afterwards. */
    @Field()
    status!: string
}
