import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

/** The query of the direct upload door: the file name; the media type is the content type of the request. */
export class DirectUploadQuery {
    /** The file name; `file` when the caller sends none. */
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    filename?: string
}

/** The path parameters of the content doors: the upload the bytes are for or come from. */
export class UploadContentParams {
    /** The upload id. */
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    uploadId!: string
}
