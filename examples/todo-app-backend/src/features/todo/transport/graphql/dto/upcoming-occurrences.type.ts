import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One materialised occurrence of a rule. */
export class MaterialisedOccurrenceType {
    /** The occurrence id, the same as the id of the task it spawned. */
    @Field(() => ID)
    occurrenceId!: string

    /** The local date it is due on. */
    @Field()
    localDate!: string

    /** The instant it is due at, as an ISO string. */
    @Field()
    dueAtUtc!: string

    /** The lifecycle state. */
    @Field()
    status!: string
}

@ObjectType()
/** The payload of upcomingOccurrences: the materialised occurrences of a rule and the dates it fires on next. */
export class UpcomingOccurrencesType {
    /** The rule id. */
    @Field(() => ID)
    ruleId!: string

    /** Every occurrence already materialised for the rule. */
    @Field(() => [MaterialisedOccurrenceType])
    materialised!: Array<MaterialisedOccurrenceType>

    /** The dates the rule fires on next, computed live; empty for an ended rule. */
    @Field(() => [String], { description: "The dates the rule fires on next, computed live. Empty for an ended rule." })
    previewDates!: Array<string>
}
