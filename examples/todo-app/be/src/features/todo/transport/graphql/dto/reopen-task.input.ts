import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The reopenTask arguments: the id of the task to reopen. */
export class ReopenTaskInput {
    /** The task id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    id!: string
}
