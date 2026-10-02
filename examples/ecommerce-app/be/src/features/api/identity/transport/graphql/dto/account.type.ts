import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The caller account joined with live buyer status from the order service. */
export class AccountType {
    /** The person id. */
    @Field(() => ID)
    personId!: string

    /** The sign-in email. */
    @Field()
    email!: string

    /** True when the order service reports confirmed orders. */
    @Field()
    hasOrders!: boolean
}
