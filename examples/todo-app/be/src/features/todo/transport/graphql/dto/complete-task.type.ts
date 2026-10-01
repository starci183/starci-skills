import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of completeTask: the task id and whether it is complete. */
export class CompleteTaskType {
    /** The task id. */
    @Field(() => ID)
    taskId!: string

    /** Whether the task is complete. */
    @Field()
    complete!: boolean
}
