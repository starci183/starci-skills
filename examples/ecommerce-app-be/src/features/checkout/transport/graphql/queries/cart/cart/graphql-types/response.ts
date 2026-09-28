import {
    Field, ID, Int, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** One cart line as the door answers it: the product and how many of it the person holds. */
export class CartLineResponse {
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
/** A catalog product as the door answers it: id, name, the minor-unit price and live stock. */
export class CatalogProductResponse {
  @Field(() => ID)
      id!: string

  @Field()
      name!: string

  @Field(() => Int)
      priceMinorUnits!: number

  @Field(() => Int)
      stock!: number

  constructor(id: string, name: string, priceMinorUnits: number, stock: number) {
      this.id = id
      this.name = name
      this.priceMinorUnits = priceMinorUnits
      this.stock = stock
  }
}

@ObjectType()
/** The cart view: the person's cart lines plus the catalog snapshot the confirmation prices against. */
export class CartResponse {
  @Field(() => [CartLineResponse])
      items!: Array<CartLineResponse>

  @Field(() => [CatalogProductResponse])
      catalog!: Array<CatalogProductResponse>

  constructor(items: Array<CartLineResponse>, catalog: Array<CatalogProductResponse>) {
      this.items = items
      this.catalog = catalog
  }
}
