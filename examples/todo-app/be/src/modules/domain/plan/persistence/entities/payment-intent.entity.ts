import { Column, Entity, PrimaryColumn } from "typeorm"
import type { PaymentIntentStatus } from "../../plan.contracts"

@Entity("payment_intents")
/** One gateway transaction of a subscription; never deleted, and appliedAt is set at most once. */
export class PaymentIntentEntity {
    /** The intent id and idempotency key. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The subscription the payment is for. */
    @Column({ name: "subscription_id", type: "text" })
    subscriptionId!: string

    /** The gateway that owns the transfer. */
    @Column({ name: "gateway", type: "text", default: "sepay" })
    gateway!: string

    /** The id the gateway knows the transaction under. */
    @Column({ name: "gateway_intent_id", type: "text" })
    gatewayIntentId!: string

    /** The amount in minor units. */
    @Column({ name: "amount", type: "integer" })
    amount!: number

    /** The currency. */
    @Column({ name: "currency", type: "text", default: "VND" })
    currency!: string

    /** The state of the intent. */
    @Column({ name: "status", type: "text", default: "pending" })
    status!: PaymentIntentStatus

    /** When the intent was applied. */
    @Column({ name: "applied_at", type: "timestamptz", nullable: true })
    appliedAt!: Date | null
}
