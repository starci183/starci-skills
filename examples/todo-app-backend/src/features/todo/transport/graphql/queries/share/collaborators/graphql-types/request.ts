import {
    Field, ID, InputType
} from "@nestjs/graphql"

/** The GraphQL request for collaborators. */
@InputType()
/** Validated GraphQL request object. */
export class CollaboratorsRequest {
    @Field(() => ID)
        taskId!: string
}
