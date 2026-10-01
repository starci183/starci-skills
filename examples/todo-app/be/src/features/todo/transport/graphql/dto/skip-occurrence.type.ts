import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of skipOccurrence: the occurrence and its status after the transition. */
export class SkipOccurrenceType {
    /** The occurrence id. */
    @Field(() => ID)
    occurrenceId!: string

    /** The occurrence status afterwards. */
    @Field()
    status!: string
}
