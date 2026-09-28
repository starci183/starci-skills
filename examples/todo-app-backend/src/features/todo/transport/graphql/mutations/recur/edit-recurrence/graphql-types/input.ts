import {
    Field, ID, InputType, Int 
} from "@nestjs/graphql"
import {
    IsIn, IsInt, IsOptional, IsString, Matches, Min 
} from "class-validator"
import {
    RecurFrequencyInput 
} from "../../make-recurring/graphql-types/input"

@InputType()
/** The rule patch: ruleId plus any of frequency/n/dayOfMonth/timeZone/time - absent fields keep their current value. */
export class EditRecurrenceInput {
  @Field(() => ID)
  @IsString()
      ruleId!: string

  @Field(() => RecurFrequencyInput,
      {
          nullable: true 
      })
  @IsOptional()
  @IsIn(Object.values(RecurFrequencyInput))
      frequency?: RecurFrequencyInput

  @Field(() => Int,
      {
          nullable: true 
      })
  @IsOptional()
  @IsInt()
  @Min(1)
      n?: number

  @Field(() => Int,
      {
          nullable: true 
      })
  @IsOptional()
  @IsInt()
  @Min(1)
      dayOfMonth?: number

  @Field({
      nullable: true, description: "IANA time zone, e.g. Europe/Berlin." 
  })
  @IsOptional()
      timeZone?: string

  @Field({
      nullable: true, description: "Local HH:MM the rule fires at, in timeZone." 
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      time?: string
}
