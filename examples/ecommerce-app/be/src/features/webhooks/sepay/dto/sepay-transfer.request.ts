import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator"

/** The bank transfer notice the notifier POSTs: every field bounded and validated, unknown fields refused by the global pipe. */
export class SepayTransferRequest {
    /** The notifier's id of this transfer; the inbox key of the intake. */
    @IsInt()
    @Min(1)
    @Max(Number.MAX_SAFE_INTEGER)
    id!: number

    /** The bank that received the transfer. */
    @IsString()
    @Length(1, 64)
    gateway!: string

    /** When the bank booked the transfer, as the notifier formats it. */
    @IsString()
    @Length(1, 32)
    transactionDate!: string

    /** The receiving account number. */
    @IsString()
    @Length(1, 32)
    accountNumber!: string

    /** The payment code the buyer wrote in the transfer, the reference of the order it pays. */
    @IsString()
    @Length(1, 64)
    code!: string

    /** The transfer text. */
    @IsString()
    @Length(0, 512)
    content!: string

    /** `in` is money received; only that settles an order. */
    @IsIn(["in", "out"])
    transferType!: "in" | "out"

    /** The transferred amount in minor units of the account currency. */
    @IsInt()
    @Min(0)
    @Max(1_000_000_000_000)
    transferAmount!: number

    /** The account balance after the transfer. */
    @IsInt()
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    accumulated!: number

    /** The virtual sub account, when the bank has one. */
    @IsOptional()
    @IsString()
    @Length(1, 64)
    subAccount!: string | null

    /** The bank reference of the transfer. */
    @IsString()
    @Length(1, 64)
    referenceCode!: string

    /** The bank description of the transfer. */
    @IsString()
    @Length(0, 512)
    description!: string
}
