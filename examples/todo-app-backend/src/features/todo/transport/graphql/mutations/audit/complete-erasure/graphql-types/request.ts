import {
    Field, ID, InputType
} from "@nestjs/graphql"

/** The GraphQL request for complete erasure. */
@InputType()
/** Validated GraphQL request object. */
export class CompleteErasureRequest {
    @Field(() => ID)
        requestId!: string
}
