import {
    Field, ID, Int, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The confirmation the place-order mutation answers: the order id, total, payment id and
 * whether this was an idempotent replay - the same fields the retired `POST /orders` returned. */
export class PlaceOrderResponse {
  @Field(() => ID)
      orderId!: string

  @Field()
      status!: string

  @Field(() => Int)
      totalMinorUnits!: number

  @Field()
      currency!: string

  @Field(() => ID)
      paymentId!: string

  @Field()
      replayed!: boolean

  constructor(
      orderId: string,
      status: string,
      totalMinorUnits: number,
      currency: string,
      paymentId: string,
      replayed: boolean,
  ) {
      this.orderId = orderId
      this.status = status
      this.totalMinorUnits = totalMinorUnits
      this.currency = currency
      this.paymentId = paymentId
      this.replayed = replayed
  }
}
