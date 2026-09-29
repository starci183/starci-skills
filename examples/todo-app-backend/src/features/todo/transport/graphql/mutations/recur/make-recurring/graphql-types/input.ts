import {
    Field, InputType, Int, registerEnumType 
} from "@nestjs/graphql"
import {
    IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength 
} from "class-validator"
import {
    TODO_MESSAGES 
} from "../../../../../../messages/index"

/** The cadence choices a rule accepts; each member's doc says what choosing it schedules. */
export enum RecurFrequencyInput {
  /** The rule fires once per weekday (Mon-Fri) at `time` - weekends are skipped. */
  EveryWeekday = "every-weekday",
  /** The rule fires every `n` calendar days counting from `startDate`; requires `n`. */
  EveryNDays = "every-n-days",
  /** The rule fires once per month on `dayOfMonth`; requires `dayOfMonth` (1-31). */
  MonthlyDay = "monthly-day",
}

registerEnumType(RecurFrequencyInput,
    {
        name: "RecurFrequency",
        description: TODO_MESSAGES.get("makeRecurring.input.frequency"),
    })

@InputType()
/** The new rule's shape: title, frequency (plus n/dayOfMonth when the cadence needs them), timeZone, local time, startDate. */
export class MakeRecurringInput {
  @Field()
  @IsString()
  @MinLength(1)
      title!: string

  @Field(() => RecurFrequencyInput)
  @IsIn(Object.values(RecurFrequencyInput))
      frequency!: RecurFrequencyInput

  @Field(() => Int,
      {
          nullable: true, description: TODO_MESSAGES.get("makeRecurring.input.n") 
      })
  @IsOptional()
  @IsInt()
  @Min(1)
      n?: number

  @Field(() => Int,
      {
          nullable: true, description: TODO_MESSAGES.get("makeRecurring.input.dayOfMonth") 
      })
  @IsOptional()
  @IsInt()
  @Min(1)
      dayOfMonth?: number

  @Field({
      description: TODO_MESSAGES.get("makeRecurring.input.timeZone") 
  })
  @IsString()
  @MinLength(1)
      timeZone!: string

  @Field({
      description: TODO_MESSAGES.get("makeRecurring.input.time") 
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      time!: string

  @Field({
      description: TODO_MESSAGES.get("makeRecurring.input.startDate") 
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
      startDate!: string
}
