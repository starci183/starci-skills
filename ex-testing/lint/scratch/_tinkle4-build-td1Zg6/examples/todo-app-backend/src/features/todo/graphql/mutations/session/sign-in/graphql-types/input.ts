import {
    Field, InputType 
} from "@nestjs/graphql"
import {
    IsEmail, IsString, MinLength 
} from "class-validator"

/** transport/graphql boundary representation for signIn - a runtime-validated class, not an interface,
 * because class-validator's decorators need real runtime metadata to enforce anything at all. */
@InputType()
/** signIn's credentials: account email and password, validated at the transport boundary. */
export class SignInInput {
  @Field()
  @IsEmail()
      email!: string

  @Field()
  @IsString()
  @MinLength(1)
      password!: string
}
