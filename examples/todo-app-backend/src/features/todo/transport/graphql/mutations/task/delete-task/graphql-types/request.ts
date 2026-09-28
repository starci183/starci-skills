import {
    Field, ID, InputType
} from "@nestjs/graphql"

/** The GraphQL request for delete task. */
@InputType()
/** Validated GraphQL request object. */
export class DeleteTaskRequest {
    @Field(() => ID)
        id!: string
}
