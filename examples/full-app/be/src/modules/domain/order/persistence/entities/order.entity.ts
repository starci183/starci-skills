import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity("orders")
@Unique("uq_orders_person_idempotency", ["personId", "idempotencyKey"])
/** A placed order. The idempotency key is scoped per person: two buyers reusing one key string get two independent orders. */
export class OrderEntity {
    /** The order id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The buyer, kept as an id only. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The lifecycle state; a varchar with a CHECK in the migration, not a native enum. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: "pending" | "paid" | "expired" | "cancelled"

    /** The order total in minor units. */
    @Column({ name: "total_minor_units", type: "int" })
    totalMinorUnits!: number

    /** The ISO currency code. */
    @Column({ name: "currency", type: "varchar", length: 3 })
    currency!: string

    /** The replay key echoed back so a repeated confirmation returns the same order. */
    @Column({ name: "idempotency_key", type: "text", nullable: true })
    idempotencyKey!: string | null

    /** The object key of the archived receipt (`receipts/<id>.json`); null until the receipt is stored. */
    @Column({ name: "receipt_key", type: "text", nullable: true })
    receiptKey!: string | null

    /** When the order was placed. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When a bank transfer paid the order; null until it is paid. */
    @Column({ name: "paid_at", type: "timestamptz", nullable: true })
    paidAt!: Date | null
}
