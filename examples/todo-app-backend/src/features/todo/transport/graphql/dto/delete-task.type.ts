import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of deleteTask: whether the task was deleted. */
export class DeleteTaskType {
    /** True when the task was deleted. */
    @Field()
    deleted!: boolean
}
