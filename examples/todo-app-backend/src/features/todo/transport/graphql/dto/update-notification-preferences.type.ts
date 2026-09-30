import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of updateNotificationPreferences: the channel's stored preferences after the write. */
export class UpdateNotificationPreferencesType {
    /** The channel. */
    @Field()
    channel!: string

    /** True when the caller opted out of the channel. */
    @Field()
    unsubscribed!: boolean

    /** The digest window override in minutes, null for the default. */
    @Field(() => Int, { nullable: true })
    digestWindowMinutes!: number | null
}
