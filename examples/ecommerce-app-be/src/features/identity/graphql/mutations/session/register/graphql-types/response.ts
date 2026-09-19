import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The registered person: the id the account view and every person-keyed surface answers under. */
export class RegisterResponse {
  @Field(() => ID)
      personId!: string

  constructor(personId: string) {
      this.personId = personId
  }
}
