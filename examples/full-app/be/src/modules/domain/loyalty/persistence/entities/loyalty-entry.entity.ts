import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("loyalty_entries")
/** One loyalty ledger entry: the points a paid order earned, keyed by the order id. */
export class LoyaltyEntryEntity {
    /** The entry id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The buyer who earned the points, kept as an id only. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The paid order, kept as an id only; unique, so an order earns its points once. */
    @Column({ name: "order_id", type: "uuid", unique: true })
    orderId!: string

    /** The points the order earned. */
    @Column({ name: "points", type: "int" })
    points!: number

    /** When the entry was recorded. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
