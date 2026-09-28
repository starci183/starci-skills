import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** One materialised occurrence: occurrenceId (the task it spawned), localDate, dueAtUtc, status. */
export class MaterialisedOccurrenceResponse {
  @Field(() => ID)
      occurrenceId!: string

  @Field()
      localDate!: string

  @Field()
      dueAtUtc!: string

  @Field()
      status!: string

  constructor(occurrenceId: string, localDate: string, dueAtUtc: string, status: string) {
      this.occurrenceId = occurrenceId
      this.localDate = localDate
      this.dueAtUtc = dueAtUtc
      this.status = status
  }
}

@ObjectType()
/** A rule's occurrence picture: materialised rows plus live-computed previewDates. */
export class UpcomingOccurrencesResponse {
  @Field(() => ID)
      ruleId!: string

  @Field(() => [MaterialisedOccurrenceResponse])
      materialised!: Array<MaterialisedOccurrenceResponse>

  @Field(() => [String],
      {
          description: "Dates the rule will next fire on, computed live. Empty for an ended rule." 
      })
      previewDates!: Array<string>

  constructor(ruleId: string, materialised: Array<MaterialisedOccurrenceResponse>, previewDates: Array<string>) {
      this.ruleId = ruleId
      this.materialised = materialised
      this.previewDates = previewDates
  }
}
