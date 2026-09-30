import { Field, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsString, MaxLength } from "class-validator"

@InputType()
/** The revokeSession arguments: the token of the session to end. */
export class RevokeSessionInput {
    /** The opaque bearer token of the session to end. */
    @Field()
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    sessionToken!: string
}
