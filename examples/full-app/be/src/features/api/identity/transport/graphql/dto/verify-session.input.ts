import { Field, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsString, MaxLength } from "class-validator"

@InputType()
/** The verifySession arguments: the bearer token to check. */
export class VerifySessionInput {
    /** The opaque bearer token. */
    @Field()
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    sessionToken!: string
}
