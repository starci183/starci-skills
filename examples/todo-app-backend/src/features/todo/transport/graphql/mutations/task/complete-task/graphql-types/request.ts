import {
    Field, ID, InputType
} from "@nestjs/graphql"

/** The GraphQL request for complete task. */
@InputType()
/** Validated GraphQL request object. */
export class CompleteTaskRequest {
    @Field(() => ID)
        id!: string
}
