import { IsIn, IsInt, IsString, Length, Max, Min } from "class-validator"

/** The notification the payment gateway POSTs: bounded and validated like any input. */
export class PaymentNotificationRequest {
    /** The gateway's id of this delivery; the inbox key of the intake. */
    @IsString()
    @Length(1, 64)
    eventId!: string

    @IsString()
    @Length(1, 64)
    orderId!: string

    @IsIn(["confirmed", "failed"])
    status!: "confirmed" | "failed"

    @IsInt()
    @Min(0)
    @Max(1_000_000_000)
    amountCents!: number
}
