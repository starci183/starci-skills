import {
    Field, Int, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The caller's plan snapshot: plan name, active-task cap (null on paid), current activeCount. */
export class PlanUsageResponse {
  @Field()
      plan!: string

  @Field(() => Int,
      {
          nullable: true, description: "null on the paid plan: no cap." 
      })
      cap!: number | null

  @Field(() => Int)
      activeCount!: number

  constructor(plan: string, cap: number | null, activeCount: number) {
      this.plan = plan
      this.cap = cap
      this.activeCount = activeCount
  }
}
