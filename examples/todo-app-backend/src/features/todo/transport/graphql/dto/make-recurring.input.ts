import { Field, InputType, Int, registerEnumType } from "@nestjs/graphql"
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from "class-validator"
import { RuleFrequency } from "@modules/domain/recur"

registerEnumType(RuleFrequency, { name: "RecurFrequency" })

@InputType()
/** The makeRecurring arguments: the shape of the new rule. */
export class MakeRecurringInput {
    /** The title of the tasks the rule creates. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    title!: string

    /** The cadence. */
    @Field(() => RuleFrequency)
    @IsEnum(RuleFrequency)
    frequency!: RuleFrequency

    /** Required only when frequency is every-n-days. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    n?: number

    /** Required only when frequency is monthly-day. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    dayOfMonth?: number

    /** The IANA zone the time is read in. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    timeZone!: string

    /** The local time HH:MM the rule fires at. */
    @Field()
    @IsString()
    @MaxLength(5)
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    time!: string

    /** The first date the rule can fire on, YYYY-MM-DD. */
    @Field()
    @IsString()
    @MaxLength(10)
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    startDate!: string
}
