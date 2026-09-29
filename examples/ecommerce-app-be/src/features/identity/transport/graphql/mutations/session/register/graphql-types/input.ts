import {
    Field, InputType 
} from "@nestjs/graphql"
import {
    IsString, MaxLength
} from "class-validator"

/** transport/graphql boundary representation for register - a runtime class, not an interface,
 * matching the shape the retired REST door read off the request body. */
@InputType()
/** register's credentials: account email and password, checked by the resolver before any account work. */
export class RegisterInput {
  @Field()
  @IsString()
  @MaxLength(320)
      email!: string

  @Field()
  @IsString()
  @MaxLength(256)
      password!: string
}
