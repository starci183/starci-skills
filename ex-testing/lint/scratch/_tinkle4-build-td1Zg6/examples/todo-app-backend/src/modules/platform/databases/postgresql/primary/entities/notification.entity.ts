import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.notify.notification: id equals dedupeKey - there is no separate surrogate id (decision.notify.dedupe-key).
 * Two admissions with the same dedupeKey resolve to the same row; digestGroupId is set exactly once, when
 * the notification joins a digest window (br.notify.digest.window), and never moved afterward.
 */
@Entity({
    name: "notify_notifications" 
})
/** TypeORM entity mapped to the notify notification row on the primary database; services reach it through the entity manager, not a repository. */
export class NotifyNotificationEntity {
  @PrimaryColumn("text")
      id!: string

  @Column("text")
      kind!: string

  @Column("text",
      {
          name: "recipient_id" 
      })
      recipientId!: string

  @Column("jsonb")
      payload!: Record<string, unknown>

  @Column("text",
      {
          name: "digest_group_id", nullable: true 
      })
      digestGroupId!: string | null

  @Column("timestamptz",
      {
          name: "created_at" 
      })
      createdAt!: Date
}
