import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export enum RecurFrequencyInput {
  EveryWeekday = 'every-weekday',
  EveryNDays = 'every-n-days',
  MonthlyDay = 'monthly-day',
}

registerEnumType(RecurFrequencyInput, {
  name: 'RecurFrequency',
  description: 'data.recur.rule.frequency: every-weekday, every-n-days, or monthly-day.',
});

@InputType()
export class MakeRecurringInput {
  @Field()
  @IsString()
  @MinLength(1)
  title!: string;

  @Field(() => RecurFrequencyInput)
  @IsIn(Object.values(RecurFrequencyInput))
  frequency!: RecurFrequencyInput;

  @Field(() => Int, { nullable: true, description: 'Required only when frequency is every-n-days.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  n?: number;

  @Field(() => Int, { nullable: true, description: 'Required only when frequency is monthly-day; 1-31.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dayOfMonth?: number;

  @Field({ description: 'IANA time zone, e.g. Europe/Berlin.' })
  @IsString()
  @MinLength(1)
  timeZone!: string;

  @Field({ description: 'Local HH:MM the rule fires at, in timeZone.' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @Field({ description: 'Local calendar date (YYYY-MM-DD) the rule begins.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;
}
