import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

/** The body of a SePay delivery: which transaction, what the gateway reports, and when the paid period ends. */
export class SepayWebhookRequest {
    /** The id the gateway knows the transaction under; it is also the id of the delivery. */
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    id!: string

    /** What the gateway reports for the transaction. */
    @IsIn(["paid", "failed"])
    status!: "paid" | "failed"

    /** The end of the paid period as an ISO 8601 instant, absent for the default period. */
    @IsOptional()
    @IsISO8601()
    @MaxLength(64)
    periodEnd?: string
}
