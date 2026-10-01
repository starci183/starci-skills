import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity("cart_items")
@Unique("uq_cart_items_person_product", ["personId", "productId"])
/** One line of a person cart: the (person, product) pair is unique and the quantity accumulates. */
export class CartItemEntity {
    /** The line id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The person, kept as an id only: identity owns the person. */
    @Column({ name: "person_id", type: "uuid" })
    personId!: string

    /** The SKU, kept as an id only: the catalog owns the product. */
    @Column({ name: "product_id", type: "text" })
    productId!: string

    /** How many units the person holds. */
    @Column({ name: "quantity", type: "int" })
    quantity!: number
}
