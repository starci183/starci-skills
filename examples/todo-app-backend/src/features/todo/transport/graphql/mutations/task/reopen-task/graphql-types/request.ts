import {
    Field, ID, InputType
} from "@nestjs/graphql"

/** The GraphQL request for reopen task. */
@InputType()
/** Validated GraphQL request object. */
export class ReopenTaskRequest {
    @Field(() => ID)
        id!: string
}
