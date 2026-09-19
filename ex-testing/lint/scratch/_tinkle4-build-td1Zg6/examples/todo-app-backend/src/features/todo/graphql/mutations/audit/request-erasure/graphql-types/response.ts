import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** requestErasure's payload: the new requestId and its already-'verified' state. */
export class RequestErasureResponse {
  @Field(() => ID)
      requestId!: string

  @Field()
      state!: string

  constructor(requestId: string, state: string) {
      this.requestId = requestId
      this.state = state
  }
}
