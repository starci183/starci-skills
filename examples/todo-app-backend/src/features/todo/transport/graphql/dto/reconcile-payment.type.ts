import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of reconcilePayment: what the gateway said and what it caused. */
export class ReconcilePaymentType {
    /** The status the gateway reported just now: pending, paid or failed. */
    @Field()
    gatewayStatus!: string

    /** True when this call applied the intent. */
    @Field()
    applied!: boolean

    /** The subscription status afterwards. */
    @Field()
    subscriptionStatus!: string
}
