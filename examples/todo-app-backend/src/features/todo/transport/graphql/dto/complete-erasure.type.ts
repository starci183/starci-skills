import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of completeErasure: the request id and its state complete. */
export class CompleteErasureType {
    /** The request id. */
    @Field(() => ID)
    requestId!: string

    /** The state: complete. */
    @Field()
    state!: string
}
