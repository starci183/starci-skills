import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of signIn: the token to present as `Authorization: Bearer` and the person it resolves to. */
export class SignInType {
    /** The opaque session token. */
    @Field()
    sessionToken!: string

    /** The person the session belongs to. */
    @Field()
    personId!: string
}
