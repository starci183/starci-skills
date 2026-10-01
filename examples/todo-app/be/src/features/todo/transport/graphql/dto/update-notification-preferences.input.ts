import { NOTIFY_CHANNEL_EMAIL } from "@modules/domain/notify"
import { Field, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** The updateNotificationPreferences arguments: the channel plus the fields to change. */
export class UpdateNotificationPreferencesInput {
    /** The channel, email when omitted. */
    @Field({ defaultValue: NOTIFY_CHANNEL_EMAIL })
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    channel!: string

    /** The new opt-out flag; omitted keeps the current value. */
    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean()
    unsubscribed?: boolean

    /** The new digest window in minutes; omitted keeps the current value. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    digestWindowMinutes?: number
}
