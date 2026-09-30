import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of planUsage: the plan of the caller against the active tasks the caller holds. */
export class PlanUsageType {
    /** The effective plan: free or paid. */
    @Field()
    plan!: string

    /** How many active tasks the plan allows; null on the paid plan, which has no cap. */
    @Field(() => Int, { nullable: true })
    cap!: number | null

    /** How many active tasks the caller holds now. */
    @Field(() => Int)
    activeCount!: number
}
