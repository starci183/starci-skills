import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ReconcilePaymentResponse {
  @Field()
  gatewayStatus!: string;

  @Field()
  applied!: boolean;

  @Field()
  subscriptionStatus!: string;

  constructor(gatewayStatus: string, applied: boolean, subscriptionStatus: string) {
    this.gatewayStatus = gatewayStatus;
    this.applied = applied;
    this.subscriptionStatus = subscriptionStatus;
  }
}
