import {
    Field, ID, InputType, Int 
} from "@nestjs/graphql"

@InputType()
/** The add-cart-item payload: the product and how many of it to hold - a non-positive quantity is
 * refused by the resolver with REQUEST_INVALID, matching the retired REST door. */
export class AddCartItemInput {
  @Field(() => ID)
      productId!: string

  @Field(() => Int)
      quantity!: number
}
