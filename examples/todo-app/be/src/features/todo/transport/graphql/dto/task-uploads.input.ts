import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The taskUploads arguments: the task whose attachments are listed. */
export class TaskUploadsInput {
    /** The task id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    taskId!: string
}
