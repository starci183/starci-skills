import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of signOut: true once the session is gone. */
export class SignOutType {
    /** Whether the session was ended. */
    @Field()
    signedOut!: boolean
}
