import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from "class-validator"
import { RuleFrequency } from "@modules/domain/recur"

@InputType()
/** The editRecurrence arguments: the rule and any of the fields to change; an absent field keeps its value, a null n or dayOfMonth clears it. */
export class EditRecurrenceInput {
    /** The rule id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    ruleId!: string

    /** The new cadence. */
    @Field(() => RuleFrequency, { nullable: true })
    @IsOptional()
    @IsEnum(RuleFrequency)
    frequency?: RuleFrequency

    /** The new interval in days; null clears it. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    n?: number | null

    /** The new day of month; null clears it. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    dayOfMonth?: number | null

    /** The new IANA zone. */
    @Field({ nullable: true, description: "IANA time zone, for example Asia/Ho_Chi_Minh." })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    timeZone?: string

    /** The new local time HH:MM. */
    @Field({ nullable: true, description: "Local time HH:MM at which the rule fires, in timeZone." })
    @IsOptional()
    @IsString()
    @MaxLength(5)
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    time?: string
}
