import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The reconcilePayment arguments: the payment intent to check. */
export class ReconcilePaymentInput {
    /** The payment intent id, as upgradePlan returned it. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    paymentIntentId!: string
}
