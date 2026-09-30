import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength, MinLength } from "class-validator"

@InputType()
/** The endRecurrence arguments: the rule and the local date it ends on. */
export class EndRecurrenceInput {
    /** The rule id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    ruleId!: string

    /** The local date the rule ends on, in the zone of the rule. */
    @Field()
    @IsString()
    @MaxLength(10)
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    endedAt!: string
}
