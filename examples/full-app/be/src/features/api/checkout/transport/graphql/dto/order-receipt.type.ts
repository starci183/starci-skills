import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A time-limited download link of an order's receipt. */
export class OrderReceiptType {
    /** The presigned download URL of the receipt document. */
    @Field()
    url!: string

    /** When the link stops working, ISO 8601. */
    @Field()
    expiresAt!: string
}
