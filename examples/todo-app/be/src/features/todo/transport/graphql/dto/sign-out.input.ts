import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The signOut argument: the token of the session the caller wants destroyed. */
export class SignOutInput {
    /** The session token to end. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    sessionToken!: string
}
