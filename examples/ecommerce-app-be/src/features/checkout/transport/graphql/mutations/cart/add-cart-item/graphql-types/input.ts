import {
    Field, ID, InputType, Int 
} from "@nestjs/graphql"
import {
    IsInt, IsString, Max, MaxLength
} from "class-validator"

@InputType()
/** The add-cart-item payload: the product and how many of it to hold - a non-positive quantity is
 * refused by the resolver with REQUEST_INVALID, matching the retired REST door. */
export class AddCartItemInput {
  @Field(() => ID)
  @IsString()
  @MaxLength(64)
      productId!: string

  @Field(() => Int)
  @IsInt()
  @Max(1_000_000)
      quantity!: number
}
