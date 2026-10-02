import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("order_summaries")
/** The read-model row of one order of the order context: written only by the order-summary projection. */
export class OrderSummaryProjectionEntity {
    /** The order, the natural key of the row. */
    @PrimaryColumn({ name: "order_id", type: "uuid" })
    orderId!: string

    /** The buyer, kept as an id only. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The lifecycle state of the order. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: string

    /** The order total in minor units. */
    @Column({ name: "total_minor_units", type: "int" })
    totalMinorUnits!: number

    /** How many lines the order has. */
    @Column({ name: "line_count", type: "int" })
    lineCount!: number

    /** The loyalty points the paid order earned; zero until they are granted. */
    @Column({ name: "loyalty_points", type: "int" })
    loyaltyPoints!: number

    /** When the order was placed. */
    @Column({ name: "placed_at", type: "timestamptz" })
    placedAt!: Date

    /** When the order was paid; null until it is. */
    @Column({ name: "paid_at", type: "timestamptz", nullable: true })
    paidAt!: Date | null
}
