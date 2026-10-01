import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The collaborators arguments: the task whose invitations are listed. */
export class ListCollaboratorsInput {
    /** The task id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    taskId!: string
}
