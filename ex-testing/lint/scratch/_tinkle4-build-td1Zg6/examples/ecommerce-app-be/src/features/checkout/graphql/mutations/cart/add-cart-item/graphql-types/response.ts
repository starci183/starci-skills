import {
    Field, ID, Int, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** One cart line as the door answers it: the product and how many of it the person holds. */
export class AddCartItemLineResponse {
  @Field(() => ID)
      productId!: string

  @Field(() => Int)
      quantity!: number

  constructor(productId: string, quantity: number) {
      this.productId = productId
      this.quantity = quantity
  }
}

@ObjectType()
/** The add-cart-item answer: the merged cart line the upsert left the person holding. */
export class AddCartItemResponse {
  @Field(() => AddCartItemLineResponse)
      item!: AddCartItemLineResponse

  constructor(item: AddCartItemLineResponse) {
      this.item = item
  }
}
