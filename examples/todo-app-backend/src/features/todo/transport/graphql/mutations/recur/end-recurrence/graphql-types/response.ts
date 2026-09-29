import {
    Field, ID, Int, ObjectType 
} from "@nestjs/graphql"
import {
    TODO_MESSAGES 
} from "../../../../../../messages/index"

@ObjectType()
/** The end's outcome: ruleId, endedAt, and how many occurrences the end orphaned. */
export class EndRecurrenceResponse {
  @Field(() => ID)
      ruleId!: string

  @Field()
      endedAt!: string

  @Field(() => Int,
      {
          description: TODO_MESSAGES.get("endRecurrence.response.orphanedCount") 
      })
      orphanedCount!: number

  constructor(ruleId: string, endedAt: string, orphanedCount: number) {
      this.ruleId = ruleId
      this.endedAt = endedAt
      this.orphanedCount = orphanedCount
  }
}
