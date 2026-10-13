import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The get-resource arguments: the id of the row. */
export class GetResourceInput {
    /** The id of the resource row. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
