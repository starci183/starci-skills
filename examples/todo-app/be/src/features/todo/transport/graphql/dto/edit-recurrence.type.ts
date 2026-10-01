import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of editRecurrence: the rule after the edit. */
export class EditRecurrenceType {
    /** The rule id. */
    @Field(() => ID)
    ruleId!: string

    /** The cadence. */
    @Field()
    frequency!: string

    /** The IANA zone. */
    @Field()
    timeZone!: string

    /** The local time. */
    @Field()
    time!: string
}
