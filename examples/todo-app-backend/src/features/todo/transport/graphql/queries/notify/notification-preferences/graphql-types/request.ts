import {
    Field, InputType
} from "@nestjs/graphql"

/** The optional channel selector for the caller's notification preferences. */
@InputType()
/** Validated GraphQL request object. */
export class NotificationPreferencesRequest {
    @Field(() => String,
        {
            nullable: true
        })
        channel?: string
}
