import {
    Field, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength, MinLength
} from "class-validator"

/** The GraphQL request for upcoming occurrences. */
@InputType()
/** Validated GraphQL request object. */
export class UpcomingOccurrencesRequest {
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        ruleId!: string
}
