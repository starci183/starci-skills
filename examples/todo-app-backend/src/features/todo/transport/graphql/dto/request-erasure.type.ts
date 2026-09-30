import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of requestErasure: the new request id and its state, already verified. */
export class RequestErasureType {
    /** The request id the completion takes. */
    @Field(() => ID)
    requestId!: string

    /** The state of the request. */
    @Field()
    state!: string
}
