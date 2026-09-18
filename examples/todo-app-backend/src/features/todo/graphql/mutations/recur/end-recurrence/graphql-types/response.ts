import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EndRecurrenceResponse {
  @Field(() => ID)
  ruleId!: string;

  @Field()
  endedAt!: string;

  @Field(() => Int, { description: 'How many materialised occurrences became orphaned by this call.' })
  orphanedCount!: number;

  constructor(ruleId: string, endedAt: string, orphanedCount: number) {
    this.ruleId = ruleId;
    this.endedAt = endedAt;
    this.orphanedCount = orphanedCount;
  }
}
