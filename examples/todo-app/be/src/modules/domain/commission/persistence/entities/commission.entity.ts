import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("commissions")
/** One referral commission per paid payment; never rewritten after it accrued. */
export class CommissionEntity {
    /** The accrual id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The person who earns the commission. */
    @Column({ name: "referrer_id", type: "text" })
    referrerId!: string

    /** The person who paid. */
    @Column({ name: "buyer_id", type: "text" })
    buyerId!: string

    /** The payment the commission accrued on; unique, so a payment accrues once. */
    @Column({ name: "payment_id", type: "text", unique: true })
    paymentId!: string

    /** The commission in minor units. */
    @Column({ name: "amount", type: "integer" })
    amount!: number

    /** When the commission accrued. */
    @Column({ name: "accrued_at", type: "timestamptz" })
    accruedAt!: Date
}
