import { Field, InputType } from "@nestjs/graphql"
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator"

@InputType()
/** The signIn arguments: the email and the password. */
export class SignInInput {
    /** The sign-in email. */
    @Field()
    @IsEmail()
    @MaxLength(320)
    email!: string

    /** The plain password. */
    @Field()
    @IsString()
    @IsNotEmpty()
    @MaxLength(256)
    password!: string
}
