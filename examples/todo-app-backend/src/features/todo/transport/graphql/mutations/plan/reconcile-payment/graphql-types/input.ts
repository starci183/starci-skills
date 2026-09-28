import {
    Field, ID, InputType 
} from "@nestjs/graphql"
import {
    IsString, MinLength 
} from "class-validator"

@InputType()
/** reconcilePayment's argument object - empty today: the caller's pending intent is resolved server-side. */
export class ReconcilePaymentInput {
  @Field(() => ID)
  @IsString()
  @MinLength(1)
      paymentIntentId!: string
}
