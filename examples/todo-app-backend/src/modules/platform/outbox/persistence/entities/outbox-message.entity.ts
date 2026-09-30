import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("outbox_messages")
/** One durable message: written with the change that caused it, delivered later by the messaging capability. */
export class OutboxMessageEntity {
    /** The row id. */
    @PrimaryColumn({ name: "id", type: "uuid" })
    id!: string

    /** The queue the message is for. */
    @Column({ name: "queue", type: "varchar", length: 120 })
    queue!: string

    /** The stable event id; unique per queue. */
    @Column({ name: "event_id", type: "varchar", length: 200 })
    eventId!: string

    /** The JSON payload. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** The first instant the message may be delivered. */
    @Column({ name: "available_at", type: "timestamptz" })
    availableAt!: Date

    /** How many deliveries were started. */
    @Column({ name: "attempts", type: "int" })
    attempts!: number

    /** `pending`, `done` or `dead`. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: string

    /** The last delivery failure, when there was one. */
    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null

    /** When the message was written. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
