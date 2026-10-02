import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The person behind a live session. */
export class VerifySessionType {
    /** The person the token authenticates. */
    @Field(() => ID)
    personId!: string
}
