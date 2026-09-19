import {
    Field, InputType 
} from "@nestjs/graphql"

/** transport/graphql boundary representation for signIn - a runtime class, not an interface,
 * matching the shape the retired REST door read off the request body. */
@InputType()
/** signIn's credentials: account email and password, checked by the resolver before any credential verification. */
export class SignInInput {
  @Field()
      email!: string

  @Field()
      password!: string
}
