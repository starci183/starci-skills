import { Field, ObjectType } from "@nestjs/graphql"
import { CartLineType } from "./cart-line.type"

@ObjectType()
/** The add-to-cart answer: the merged line the caller now holds. */
export class AddCartItemType {
    /** The merged cart line. */
    @Field(() => CartLineType)
    item!: CartLineType
}
