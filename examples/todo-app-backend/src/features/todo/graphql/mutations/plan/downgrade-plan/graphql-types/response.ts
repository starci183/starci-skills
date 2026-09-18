import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DowngradePlanResponse {
  @Field(() => ID)
  subscriptionId!: string;

  @Field()
  plan!: string;

  @Field()
  status!: string;

  constructor(subscriptionId: string, plan: string, status: string) {
    this.subscriptionId = subscriptionId;
    this.plan = plan;
    this.status = status;
  }
}
