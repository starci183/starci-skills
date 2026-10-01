import { Field, ID, ObjectType } from "@nestjs/graphql"
import { UploadHeaderType } from "./upload-header.type"

@ObjectType()
/** The payload of createUploadIntent: the presigned request the client fulfils to store the bytes. */
export class CreateUploadIntentType {
    /** The upload id. */
    @Field(() => ID)
    uploadId!: string

    /** The HTTP method of the content request. */
    @Field()
    method!: string

    /** Where to send the bytes, relative to the API origin. */
    @Field()
    url!: string

    /** The headers to send with the bytes; the signed token travels here. */
    @Field(() => [UploadHeaderType])
    headers!: Array<UploadHeaderType>

    /** When the token stops being valid, as an ISO-8601 instant. */
    @Field()
    expiresAt!: string
}
