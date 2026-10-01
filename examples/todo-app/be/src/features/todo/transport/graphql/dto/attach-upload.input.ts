import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The attachUpload arguments: the upload and the task it is attached to. */
export class AttachUploadInput {
    /** The upload id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    uploadId!: string

    /** The task id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    taskId!: string
}
