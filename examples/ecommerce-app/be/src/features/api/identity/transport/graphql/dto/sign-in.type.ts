import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The new session: the token clients present as the bearer, and the person it authenticates. */
export class SignInType {
    /** The opaque bearer token. */
    @Field()
    sessionToken!: string

    /** The person the token authenticates. */
    @Field(() => ID)
    personId!: string
}
