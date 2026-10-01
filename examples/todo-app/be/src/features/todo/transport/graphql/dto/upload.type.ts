import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One upload: the payload of attachUpload and the element of taskUploads. */
export class UploadType {
    /** The upload id. */
    @Field(() => ID)
    uploadId!: string

    /** The task the upload is attached to, null while it is unattached. */
    @Field(() => ID, { nullable: true })
    taskId!: string | null

    /** The file name. */
    @Field()
    filename!: string

    /** The media type. */
    @Field()
    mime!: string

    /** The size in bytes. */
    @Field(() => Int)
    sizeBytes!: number

    /** The lifecycle: pending until the bytes land, then ready. */
    @Field()
    status!: string

    /** When the upload row was created, as an ISO-8601 instant. */
    @Field()
    createdAt!: string
}
