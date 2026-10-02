import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The orderReceipt arguments: the caller's order. */
export class OrderReceiptInput {
    /** The order. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    orderId!: string
}
