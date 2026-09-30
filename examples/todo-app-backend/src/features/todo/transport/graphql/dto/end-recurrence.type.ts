import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of endRecurrence: the ended rule and how many occurrences the end orphaned. */
export class EndRecurrenceType {
    /** The rule id. */
    @Field(() => ID)
    ruleId!: string

    /** The local date the rule ended on. */
    @Field()
    endedAt!: string

    /** How many occurrences this call orphaned. */
    @Field(() => Int, { description: "How many already materialised occurrences this call orphaned." })
    orphanedCount!: number
}
