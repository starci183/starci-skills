import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of completeOccurrence: the occurrence and its status after the transition. */
export class CompleteOccurrenceType {
    /** The occurrence id. */
    @Field(() => ID)
    occurrenceId!: string

    /** The occurrence status afterwards. */
    @Field()
    status!: string
}
