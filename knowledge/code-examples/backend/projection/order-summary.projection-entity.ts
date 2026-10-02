// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("order_summary")
/** The read-model row of one order: written only by the order-summary projection. */
export class OrderSummaryProjectionEntity {
    @PrimaryColumn("uuid")
    orderId!: string

    @Column("text")
    paymentStatus!: string

    @Column("bigint")
    totalMinorUnits!: number
}
