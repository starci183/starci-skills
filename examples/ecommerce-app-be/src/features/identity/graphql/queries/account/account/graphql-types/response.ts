import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The account view: the local person joined with live buyer status from the order service -
 * hasOrders is read through contract.checkout.order-for-identity, never assumed. */
export class AccountResponse {
  @Field(() => ID)
      personId!: string

  @Field()
      email!: string

  @Field()
      hasOrders!: boolean

  constructor(personId: string, email: string, hasOrders: boolean) {
      this.personId = personId
      this.email = email
      this.hasOrders = hasOrders
  }
}
