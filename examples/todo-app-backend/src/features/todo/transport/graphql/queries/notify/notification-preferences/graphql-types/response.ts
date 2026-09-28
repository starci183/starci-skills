import {
    Field, Int, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** One channel's stored preferences: unsubscribed flag and digest window. */
export class NotificationPreferencesResponse {
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
