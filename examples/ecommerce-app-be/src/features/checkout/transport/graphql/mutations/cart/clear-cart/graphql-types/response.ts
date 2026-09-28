import {
    Field, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The clear-cart answer: the flag the retired `DELETE /cart` door returned to say the person's
 * cart is empty now. */
export class ClearCartResponse {
  @Field()
      cleared!: boolean

  constructor(cleared: boolean) {
      this.cleared = cleared
  }
}
