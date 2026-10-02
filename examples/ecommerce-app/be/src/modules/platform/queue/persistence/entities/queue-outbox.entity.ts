import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("queue_outbox")
/** One job waiting to start: written in the transaction of the change that needs it, handed to BullMQ by the relay. */
export class QueueOutboxEntity {
    /** The row id; it becomes the BullMQ job id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The queue the job goes to. */
    @Column({ name: "queue", type: "varchar", length: 200 })
    queue!: string

    /** The payload of the job: ids, never an entity. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** When the row was written. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date

    /** When the relay handed the row to BullMQ; null while it waits. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null
}
