import {
    Field, InputType 
} from "@nestjs/graphql"
import {
    IsString, MaxLength
} from "class-validator"

/** transport/graphql boundary representation for signIn - a runtime class, not an interface,
 * matching the shape the retired REST door read off the request body. */
@InputType()
/** signIn's credentials: account email and password, checked by the resolver before any credential verification. */
export class SignInInput {
  @Field()
  @IsString()
  @MaxLength(320)
      email!: string

  @Field()
  @IsString()
  @MaxLength(256)
      password!: string
}
