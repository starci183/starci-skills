import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The get-calendar answer. */
export class GetCalendarType {
    /** The id of the calendar row. */
    @Field(() => ID)
    id!: string
}
