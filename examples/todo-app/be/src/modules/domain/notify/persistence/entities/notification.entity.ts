import { Column, Entity, PrimaryColumn } from "typeorm"
import type { NotifyPayload } from "../../notify.contracts"

@Entity("notify_notifications")
/** One notification; its id is its dedupe key, and digestGroupId is set exactly once, when it joins a digest window. */
export class NotifyNotificationEntity {
    /** The dedupe key: sha256 of kind, source event id and recipient. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** What happened, for example `task-complete`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The person the notification is for. */
    @Column({ name: "recipient_id", type: "text" })
    recipientId!: string

    /** The scalar facts of the event. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: NotifyPayload

    /** The digest window the notification joined, null until it joins one. */
    @Column({ name: "digest_group_id", type: "text", nullable: true })
    digestGroupId!: string | null

    /** When the notification was admitted. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
