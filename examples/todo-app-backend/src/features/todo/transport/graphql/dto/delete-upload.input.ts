import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The deleteUpload arguments: the id of the upload to delete. */
export class DeleteUploadInput {
    /** The upload id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    uploadId!: string
}
