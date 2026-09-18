import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CompleteErasureResponse {
  @Field(() => ID)
  requestId!: string;

  @Field()
  state!: string;

  constructor(requestId: string, state: string) {
    this.requestId = requestId;
    this.state = state;
  }
}
