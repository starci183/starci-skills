import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The orderStatusChanged arguments: the caller's order to follow. */
export class OrderStatusInput {
    /** The order. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    orderId!: string
}
