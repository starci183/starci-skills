import { NOTIFY_CHANNEL_EMAIL } from "@modules/domain/notify"
import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The unsubscribe arguments: the channel to stop receiving on. */
export class UnsubscribeInput {
    /** The channel, email when omitted. */
    @Field({ defaultValue: NOTIFY_CHANNEL_EMAIL })
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    channel!: string
}
