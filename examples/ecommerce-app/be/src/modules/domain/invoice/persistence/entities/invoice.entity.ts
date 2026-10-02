import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("invoices")
/** One invoice per order, keyed by the order id: issued, or rejected when the total was above the limit. */
export class InvoiceEntity {
    /** The invoice id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The order the invoice bills, kept as an id only; unique, so an order is invoiced once. */
    @Column({ name: "order_id", type: "uuid", unique: true })
    orderId!: string

    /** The buyer, kept as an id only. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The billed amount in minor units. */
    @Column({ name: "total_minor_units", type: "int" })
    totalMinorUnits!: number

    /** The invoice state; a varchar with a CHECK in the migration, not a native enum. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: "issued" | "rejected"

    /** When the invoice was recorded. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
