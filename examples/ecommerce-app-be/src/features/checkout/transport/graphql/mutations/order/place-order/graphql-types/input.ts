import {
    Field, InputType 
} from "@nestjs/graphql"

@InputType()
/** The place-order payload: the replay key the retired REST door read off the `Idempotency-Key`
 * header, now carried in the mutation input the way canonical GraphQL mutations do - a blank or
 * absent key is simply no idempotency, exactly as an absent header was. */
export class PlaceOrderInput {
  @Field({
      nullable: true 
  })
      idempotencyKey?: string
}
