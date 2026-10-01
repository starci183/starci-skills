import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The payload of deleteUpload: the id of the deleted upload. */
export class DeleteUploadType {
    /** The id of the deleted upload. */
    @Field(() => ID)
    uploadId!: string

    /** Always true: an error answers instead when nothing was deleted. */
    @Field()
    deleted!: boolean
}
