import {
    Column, Entity, PrimaryGeneratedColumn, Unique 
} from "typeorm"

@Entity("cart_item")
@Unique("uq_cart_item_person_product",
    ["personId",
        "productId"])
/** One line in a person's cart - the (person, product) pair is unique, quantity accumulates. */
export class CartItemEntity {
  @PrimaryGeneratedColumn("uuid")
      id!: string

  /** The person from the identity service - kept as an id only; identity owns the person. */
  @Column({
      type: "uuid", name: "person_id" 
  })
      personId!: string

  @Column({
      type: "text", name: "product_id" 
  })
      productId!: string

  @Column({
      type: "int" 
  })
      quantity!: number
}
