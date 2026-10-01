import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One task of the tasks query: id, title and completion. */
export class ListTasksType {
    /** The task id. */
    @Field(() => ID)
    taskId!: string

    /** The title. */
    @Field()
    title!: string

    /** Whether the task is complete. */
    @Field()
    complete!: boolean
}
