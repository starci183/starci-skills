import {
    Field, InputType
} from "@nestjs/graphql"

/** The GraphQL request for upcoming occurrences. */
@InputType()
/** Validated GraphQL request object. */
export class UpcomingOccurrencesRequest {
    @Field(() => String)
        ruleId!: string
}
