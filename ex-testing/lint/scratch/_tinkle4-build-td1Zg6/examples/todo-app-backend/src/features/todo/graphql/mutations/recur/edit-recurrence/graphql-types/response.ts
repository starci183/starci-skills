import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The rule's new shape after the edit: ruleId, frequency, timeZone, time. */
export class EditRecurrenceResponse {
  @Field(() => ID)
      ruleId!: string

  @Field()
      frequency!: string

  @Field()
      timeZone!: string

  @Field()
      time!: string

  constructor(ruleId: string, frequency: string, timeZone: string, time: string) {
      this.ruleId = ruleId
      this.frequency = frequency
      this.timeZone = timeZone
      this.time = time
  }
}
