import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The completeOccurrence arguments: the occurrence to complete. */
export class CompleteOccurrenceInput {
    /** The occurrence id, the same as the id of the task it spawned. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    occurrenceId!: string
}
