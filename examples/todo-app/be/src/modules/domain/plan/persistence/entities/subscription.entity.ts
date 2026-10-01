import { Column, Entity, PrimaryColumn } from "typeorm"
import type { PlanTier, SubscriptionStatus } from "../../plan.contracts"

@Entity("subscriptions")
/** One subscription per person; the status is written only by the subscription transitions. */
export class SubscriptionEntity {
    /** The subscription id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The person the subscription belongs to. */
    @Column({ name: "person_id", type: "text", unique: true })
    personId!: string

    /** The plan the row holds. */
    @Column({ name: "plan", type: "text", default: "free" })
    plan!: PlanTier

    /** The lifecycle state. */
    @Column({ name: "status", type: "text", default: "free" })
    status!: SubscriptionStatus

    /** When the paid period ends. */
    @Column({ name: "period_end", type: "timestamptz", nullable: true })
    periodEnd!: Date | null

    /** The gateway customer id. */
    @Column({ name: "gateway_customer_id", type: "text", nullable: true })
    gatewayCustomerId!: string | null
}
