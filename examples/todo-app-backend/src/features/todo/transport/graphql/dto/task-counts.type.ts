import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of taskCounts: how many tasks are open and how many are complete. */
export class TaskCountsType {
    /** Tasks not yet complete. */
    @Field(() => Int)
    open!: number

    /** Tasks complete. */
    @Field(() => Int)
    complete!: number
}
