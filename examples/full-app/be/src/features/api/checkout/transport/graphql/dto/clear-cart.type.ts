import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The confirmation that the caller cart is empty now. */
export class ClearCartType {
    /** Always true. */
    @Field()
    cleared!: boolean
}
