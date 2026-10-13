import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID } from "class-validator"

@InputType()
/** The get-{{singular}} arguments: the id of the row. */
export class Get{{Singular}}Input {
    /** The id of the {{singular}} row. */
    @Field(() => ID)
    @IsUUID()
    id!: string
}
