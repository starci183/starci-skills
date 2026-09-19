import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.notify.delivery-attempt: one row per notification (a notification has exactly one delivery
 * attempt in flight at a time, per sds.notify.delivery-lifecycle - a retry re-enters `queued` on the same
 * row rather than creating a second one). `state` is exactly one of the five
 * sds.notify.delivery-lifecycle states; `endedAt` is set iff state is delivered, bounced or suppressed;
 * `failureClass` is set iff the attempt is or was in a failure-carrying state. `history` is append-only,
 * in order, for audit and for a reader to see the retry story without a separate table.
 */
@Entity({
    name: "notify_delivery_attempts" 
})
/** TypeORM entity mapped to the notify delivery attempt row on the primary database; services reach it through the entity manager, not a repository. */
export class NotifyDeliveryAttemptEntity {
  @PrimaryColumn("text",
      {
          name: "notification_id" 
      })
      notificationId!: string

  @Column("text")
      state!: "queued" | "sending" | "delivered" | "bounced" | "suppressed"

  @Column("integer")
      attempt!: number

  @Column("text",
      {
          name: "failure_class", nullable: true 
      })
      failureClass!: "transient" | "permanent-bounce" | "retries-exhausted" | "unsubscribed" | null

  @Column("timestamptz",
      {
          name: "started_at", nullable: true 
      })
      startedAt!: Date | null

  @Column("timestamptz",
      {
          name: "ended_at", nullable: true 
      })
      endedAt!: Date | null

  @Column("jsonb")
      history!: Array<{ state: string; at: string; failureClass?: string | null }>
}
