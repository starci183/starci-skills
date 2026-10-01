import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The upcomingOccurrences arguments: the rule to look at. */
export class UpcomingOccurrencesInput {
    /** The rule id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    ruleId!: string
}
