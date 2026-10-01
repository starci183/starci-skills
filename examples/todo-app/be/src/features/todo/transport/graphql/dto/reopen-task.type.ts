import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of reopenTask: the task id and whether it is complete. */
export class ReopenTaskType {
    /** The task id. */
    @Field(() => ID)
    taskId!: string

    /** Whether the task is complete. */
    @Field()
    complete!: boolean
}
