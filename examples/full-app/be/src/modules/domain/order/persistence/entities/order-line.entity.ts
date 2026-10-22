import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("order_lines")
/** One priced line of a confirmed order: the catalog price captured at confirmation. */
export class OrderLineEntity {
    /** The line id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The order the line belongs to. */
    @Column({ name: "order_id", type: "uuid" })
    orderId!: string

    /** The SKU, kept as an id only. */
    @Column({ name: "product_id", type: "text" })
    productId!: string

    /** How many units were sold. */
    @Column({ name: "quantity", type: "int" })
    quantity!: number

    /** The unit price captured at confirmation, in minor units. */
    @Column({ name: "unit_price_minor_units", type: "int" })
    unitPriceMinorUnits!: number
}
