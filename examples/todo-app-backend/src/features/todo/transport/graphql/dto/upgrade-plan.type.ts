import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of upgradePlan: where the checkout stands. */
export class UpgradePlanType {
    /** The subscription of the caller. */
    @Field(() => ID)
    subscriptionId!: string

    /** The payment intent to reconcile later. */
    @Field(() => ID)
    paymentIntentId!: string

    /** Where the caller completes the payment. */
    @Field()
    checkoutUrl!: string

    /** The subscription status after the checkout started: pending. */
    @Field()
    status!: string
}
