import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("products")
/** A catalog product: a SKU with a price in minor units and a guarded stock counter. */
export class ProductEntity {
    /** The SKU. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The unit price in minor units (cents); money is never a float. */
    @Column({ name: "price_minor_units", type: "int" })
    priceMinorUnits!: number

    /** How many units can still be sold. */
    @Column({ name: "stock", type: "int" })
    stock!: number
}
