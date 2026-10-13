import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The create-calendar answer. */
export class CreateCalendarType {
    /** The id of the new calendar row. */
    @Field(() => ID)
    id!: string
}
