import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("payments")
/** The internal payment ledger row: one captured payment per order, keyed by the order id. */
export class PaymentEntity {
    /** The payment id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The paying person, kept as an id only. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The order the payment settles, kept as an id only; unique, so an order is never paid twice. */
    @Column({ name: "order_id", type: "uuid", unique: true })
    orderId!: string

    /** The captured amount in minor units. */
    @Column({ name: "amount_minor_units", type: "int" })
    amountMinorUnits!: number

    /** The ledger state; a varchar with a CHECK in the migration, not a native enum. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: "captured" | "refunded"

    /** When the payment was captured. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
