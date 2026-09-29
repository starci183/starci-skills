import {
    Field, ID, InputType 
} from "@nestjs/graphql"
import {
    IsString, Matches 
} from "class-validator"
import {
    TODO_MESSAGES 
} from "../../../../../../messages/index"

@InputType()
/** endRecurrence's argument: ruleId and the local date the rule ends at. */
export class EndRecurrenceInput {
  @Field(() => ID)
  @IsString()
      ruleId!: string

  @Field({
      description: TODO_MESSAGES.get("endRecurrence.input.endedAt") 
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
      endedAt!: string
}
