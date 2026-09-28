import {
    Field, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** unsubscribe's payload: the channel and its now-true unsubscribed flag. */
export class UnsubscribeResponse {
  @Field()
      channel!: string

  @Field()
      unsubscribed!: boolean

  constructor(channel: string, unsubscribed: boolean) {
      this.channel = channel
      this.unsubscribed = unsubscribed
  }
}
