import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of makeRecurring: the created rule id and its stored cadence fields. */
export class MakeRecurringType {
    /** The new rule id. */
    @Field(() => ID)
    ruleId!: string

    /** The stored title. */
    @Field()
    title!: string

    /** The cadence. */
    @Field()
    frequency!: string

    /** The IANA zone. */
    @Field()
    timeZone!: string

    /** The local time. */
    @Field()
    time!: string

    /** The first date. */
    @Field()
    startDate!: string
}
