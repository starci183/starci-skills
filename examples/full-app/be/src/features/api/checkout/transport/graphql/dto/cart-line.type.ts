import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One cart line: the product and how many units the caller holds. */
export class CartLineType {
    /** The SKU. */
    @Field(() => ID)
    productId!: string

    /** How many units the caller holds. */
    @Field(() => Int)
    quantity!: number
}
