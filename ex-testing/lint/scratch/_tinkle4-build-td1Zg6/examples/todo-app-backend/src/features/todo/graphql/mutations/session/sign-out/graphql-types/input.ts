import {
    Field, InputType 
} from "@nestjs/graphql"
import {
    IsString, MinLength 
} from "class-validator"

@InputType()
/** signOut's argument: the sessionToken the caller wants destroyed. */
export class SignOutInput {
  @Field()
  @IsString()
  @MinLength(1)
      sessionToken!: string
}
