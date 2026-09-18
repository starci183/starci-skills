import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MakeRecurringResponse {
  @Field(() => ID)
  ruleId!: string;

  @Field()
  title!: string;

  @Field()
  frequency!: string;

  @Field()
  timeZone!: string;

  @Field()
  time!: string;

  @Field()
  startDate!: string;

  constructor(ruleId: string, title: string, frequency: string, timeZone: string, time: string, startDate: string) {
    this.ruleId = ruleId;
    this.title = title;
    this.frequency = frequency;
    this.timeZone = timeZone;
    this.time = time;
    this.startDate = startDate;
  }
}
