import { Field, ObjectType } from "@nestjs/graphql"
import { CartLineType } from "./cart-line.type"
import { ProductType } from "./product.type"

@ObjectType()
/** The cart view: the caller cart lines plus the catalog snapshot the confirmation prices against. */
export class CartType {
    /** The lines of the caller cart. */
    @Field(() => [CartLineType])
    items!: Array<CartLineType>

    /** The catalog products. */
    @Field(() => [ProductType])
    catalog!: Array<ProductType>
}
