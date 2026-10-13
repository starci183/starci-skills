import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The get-{{singular}} arguments: the id of the row. */
export class Get{{Singular}}Input {
    /** The id of the {{singular}} row. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
