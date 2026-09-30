import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of createTask: the created task id and title. */
export class CreateTaskType {
    /** The created task id. */
    @Field(() => ID)
    taskId!: string

    /** The stored title. */
    @Field()
    title!: string
}
