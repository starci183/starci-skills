import {
    Field, Int, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The channel's stored preferences after the write: unsubscribed flag and digest window. */
export class UpdateNotificationPreferencesResponse {
  @Field()
      channel!: string

  @Field()
      unsubscribed!: boolean

  @Field(() => Int,
      {
          nullable: true 
      })
      digestWindowMinutes!: number | null

  constructor(channel: string, unsubscribed: boolean, digestWindowMinutes: number | null) {
      this.channel = channel
      this.unsubscribed = unsubscribed
      this.digestWindowMinutes = digestWindowMinutes
  }
}
