import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("payments")
/** The payment record of the billing database: one confirmed bank transfer per order, keyed by the order id. */
export class PaymentEntity {
    /** The payment id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The invoice the transfer paid, kept as an id only. */
    @Column({ name: "invoice_id", type: "uuid" })
    invoiceId!: string

    /** The order the payment settles, kept as an id only; unique, so an order is never paid twice. */
    @Column({ name: "order_id", type: "uuid", unique: true })
    orderId!: string

    /** The paying person, kept as an id only. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The transferred amount in minor units. */
    @Column({ name: "amount_minor_units", type: "int" })
    amountMinorUnits!: number

    /** The bank reference of the transfer. */
    @Column({ name: "provider_reference", type: "varchar", length: 64 })
    providerReference!: string

    /** When the payment was recorded. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
