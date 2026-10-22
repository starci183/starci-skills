import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("event_outbox")
/** One event waiting to leave the service: written in the transaction of the change it reports, handed to the broker by the relay. */
export class EventOutboxEntity {
    /** The position of the row: the relay sends the rows in this order. */
    @PrimaryGeneratedColumn("increment", { type: "bigint" })
    id!: string

    /** The stable event id; a repeat of one logical event carries the same id. */
    @Column({ name: "event_id", type: "varchar", length: 200 })
    eventId!: string

    /** The event name. */
    @Column({ name: "event_name", type: "varchar", length: 200 })
    eventName!: string

    /** The topic the event travels on. */
    @Column({ name: "topic", type: "varchar", length: 200 })
    topic!: string

    /** The partition key: events of one key keep their order. */
    @Column({ name: "message_key", type: "varchar", length: 200 })
    messageKey!: string

    /** The envelope `{ eventId, eventName, payload }`. */
    @Column({ name: "envelope", type: "jsonb" })
    envelope!: object

    /** When the row was written. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date

    /** When the relay handed the row to the broker; null while it waits. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null
}
