import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The notificationPreferences arguments: the channel to read, email when omitted. */
export class NotificationPreferencesInput {
    /** The channel to read. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    channel?: string
}
