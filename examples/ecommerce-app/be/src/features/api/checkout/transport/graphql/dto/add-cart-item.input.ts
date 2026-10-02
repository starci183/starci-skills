import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The addCartItem arguments: the product and a positive number of units. */
export class AddCartItemInput {
    /** The SKU. */
    @Field(() => ID)
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    productId!: string

    /** How many units to add. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(1_000_000)
    quantity!: number
}
