import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The signIn arguments: the credential pair. The handler decides whether the email is an account, so a bad email and a wrong password are refused alike. */
export class SignInInput {
    /** The email of the account. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(320)
    email!: string

    /** The password. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(1000)
    password!: string
}
