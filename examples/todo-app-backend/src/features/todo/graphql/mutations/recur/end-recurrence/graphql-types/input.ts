import { Field, ID, InputType } from '@nestjs/graphql';
import { Matches } from 'class-validator';

@InputType()
export class EndRecurrenceInput {
  @Field(() => ID)
  ruleId!: string;

  @Field({ description: 'Local calendar date (YYYY-MM-DD) the rule ends effective, in the rule\'s own time zone.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endedAt!: string;
}
