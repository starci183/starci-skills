import {
    Field, Int, ObjectType 
} from "@nestjs/graphql"
import {
    TODO_MESSAGES 
} from "../../../../../../messages/index"

@ObjectType()
/** The caller's plan snapshot: plan name, active-task cap (null on paid), current activeCount. */
export class PlanUsageResponse {
  @Field()
      plan!: string

  @Field(() => Int,
      {
          nullable: true, description: TODO_MESSAGES.get("planUsage.response.cap") 
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
