import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of unsubscribe: the channel and its now-true unsubscribed flag. */
export class UnsubscribeType {
    /** The channel. */
    @Field()
    channel!: string

    /** Always true: the caller is unsubscribed. */
    @Field()
    unsubscribed!: boolean
}
