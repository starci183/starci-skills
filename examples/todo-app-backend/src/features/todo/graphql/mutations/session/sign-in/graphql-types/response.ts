import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SignInResponse {
  @Field()
  sessionToken!: string;

  @Field()
  personId!: string;

  constructor(sessionToken: string, personId: string) {
    this.sessionToken = sessionToken;
    this.personId = personId;
  }
}
