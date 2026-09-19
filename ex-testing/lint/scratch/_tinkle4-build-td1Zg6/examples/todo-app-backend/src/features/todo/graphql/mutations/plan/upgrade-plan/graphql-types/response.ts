import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** Checkout's opening state: subscriptionId, paymentIntentId, the gateway's checkoutUrl, status 'pending'. */
export class UpgradePlanResponse {
  @Field(() => ID)
      subscriptionId!: string

  @Field(() => ID)
      paymentIntentId!: string

  @Field()
      checkoutUrl!: string

  @Field()
      status!: string

  constructor(subscriptionId: string, paymentIntentId: string, checkoutUrl: string, status: string) {
      this.subscriptionId = subscriptionId
      this.paymentIntentId = paymentIntentId
      this.checkoutUrl = checkoutUrl
      this.status = status
  }
}
