import { Field, InputType } from "@nestjs/graphql"
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The register arguments: a plausible email and a password of at least 8 characters. */
export class RegisterInput {
    /** The sign-in email. */
    @Field()
    @IsEmail()
    @MaxLength(320)
    email!: string

    /** The plain password. */
    @Field()
    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password!: string
}
