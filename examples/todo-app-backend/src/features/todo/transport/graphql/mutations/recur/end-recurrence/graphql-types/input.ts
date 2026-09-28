import {
    Field, ID, InputType 
} from "@nestjs/graphql"
import {
    IsString, Matches 
} from "class-validator"

@InputType()
/** endRecurrence's argument: ruleId and the local date the rule ends at. */
export class EndRecurrenceInput {
  @Field(() => ID)
  @IsString()
      ruleId!: string

  @Field({
      description: "Local calendar date (YYYY-MM-DD) the rule ends effective, in the rule's own time zone." 
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
      endedAt!: string
}
