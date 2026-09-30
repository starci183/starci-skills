import { Column, Entity, PrimaryColumn } from "typeorm"
import type { DeliveryHistoryEntry, DeliveryState, FailureClass } from "../../notify.contracts"

@Entity("notify_delivery_attempts")
/**
 * One row per notification: a retry re-enters `queued` on the same row. endedAt is set if and only if the state is
 * delivered, bounced or suppressed; history is append-only.
 */
export class NotifyDeliveryAttemptEntity {
    /** The notification this attempt delivers. */
    @PrimaryColumn({ name: "notification_id", type: "text" })
    notificationId!: string

    /** Where the attempt is in its lifecycle. */
    @Column({ name: "state", type: "text" })
    state!: DeliveryState

    /** How many dispatches were started. */
    @Column({ name: "attempt", type: "integer" })
    attempt!: number

    /** Why the attempt failed or was suppressed, null while nothing went wrong. */
    @Column({ name: "failure_class", type: "text", nullable: true })
    failureClass!: FailureClass | null

    /** When the first dispatch started. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When the attempt reached a terminal state. */
    @Column({ name: "ended_at", type: "timestamptz", nullable: true })
    endedAt!: Date | null

    /** Every state the attempt went through, in order. */
    @Column({ name: "history", type: "jsonb" })
    history!: Array<DeliveryHistoryEntry>
}
