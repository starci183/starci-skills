import {
    Column, Entity, PrimaryGeneratedColumn 
} from "typeorm"

@Entity("sales_order_line")
/** One priced line of a confirmed order - the catalog price snapshot taken at confirmation. */
export class OrderLineEntity {
  @PrimaryGeneratedColumn("uuid")
      id!: string

  @Column({
      type: "uuid", name: "order_id" 
  })
      orderId!: string

  @Column({
      type: "text", name: "product_id" 
  })
      productId!: string

  @Column({
      type: "int" 
  })
      quantity!: number

  @Column({
      type: "int", name: "unit_price_minor_units" 
  })
      unitPriceMinorUnits!: number
}
