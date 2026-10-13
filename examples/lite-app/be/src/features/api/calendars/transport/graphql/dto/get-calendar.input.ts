import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The get-calendar arguments: the id of the row. */
export class GetCalendarInput {
    /** The id of the calendar row. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
