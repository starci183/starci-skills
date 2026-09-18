import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UpgradePlanResponse {
  @Field(() => ID)
  subscriptionId!: string;

  @Field(() => ID)
  paymentIntentId!: string;

  @Field()
  checkoutUrl!: string;

  @Field()
  status!: string;

  constructor(subscriptionId: string, paymentIntentId: string, checkoutUrl: string, status: string) {
    this.subscriptionId = subscriptionId;
    this.paymentIntentId = paymentIntentId;
    this.checkoutUrl = checkoutUrl;
    this.status = status;
  }
}
