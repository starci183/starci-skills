import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** The placeOrder arguments: an optional replay key; a blank or absent key means no idempotency. */
export class PlaceOrderInput {
    /** The replay key. */
    @Field({ nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    idempotencyKey?: string
}
