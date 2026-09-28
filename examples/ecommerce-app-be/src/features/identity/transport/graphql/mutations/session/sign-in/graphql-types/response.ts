import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The new session: the token clients present as `Authorization: Bearer`, and the personId it resolves to. */
export class SignInResponse {
  @Field()
      sessionToken!: string

  @Field(() => ID)
      personId!: string

  constructor(sessionToken: string, personId: string) {
      this.sessionToken = sessionToken
      this.personId = personId
  }
}
