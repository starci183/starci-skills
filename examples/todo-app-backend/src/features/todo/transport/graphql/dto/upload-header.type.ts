import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One header the client must send on the content request. */
export class UploadHeaderType {
    /** The header name. */
    @Field()
    name!: string

    /** The header value. */
    @Field()
    value!: string
}
