import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A catalog product: id, name, the minor-unit price and the live stock. */
export class ProductType {
    /** The SKU. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** The unit price in minor units. */
    @Field(() => Int)
    priceMinorUnits!: number

    /** How many units can still be sold. */
    @Field(() => Int)
    stock!: number
}
