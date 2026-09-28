import {
    Field, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** signOut's payload: signedOut - true once the session row is gone. */
export class SignOutResponse {
  @Field()
      signedOut!: boolean

  constructor(signedOut: boolean) {
      this.signedOut = signedOut
  }
}
