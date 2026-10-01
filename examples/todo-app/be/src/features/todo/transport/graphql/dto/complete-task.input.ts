import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The completeTask arguments: the id of the task to complete. */
export class CompleteTaskInput {
    /** The task id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    id!: string
}
