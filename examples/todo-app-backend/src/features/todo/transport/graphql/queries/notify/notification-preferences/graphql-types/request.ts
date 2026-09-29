import {
    Field, InputType
} from "@nestjs/graphql"
import {
    IsOptional, IsString, MaxLength, MinLength
} from "class-validator"

/** The optional channel selector for the caller's notification preferences. */
@InputType()
/** Validated GraphQL request object. */
export class NotificationPreferencesRequest {
    @Field(() => String,
        {
            nullable: true
        })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        channel?: string
}
