import {
    Column, Entity, PrimaryGeneratedColumn, Unique 
} from "typeorm"

/** The order lifecycle this schema models: a confirmation writes 'confirmed' and nothing moves it. */
export type OrderStatus = "confirmed";

@Entity("sales_order")
@Unique("uq_sales_order_idempotency",
    ["personId",
        "idempotencyKey"])
/** Idempotency keys are scoped per person, like every real payments API: two buyers reusing the
 * same key string get two independent orders, never each other's. */
export class OrderEntity {
  @PrimaryGeneratedColumn("uuid")
      id!: string

  @Column({
      type: "uuid", name: "person_id" 
  })
      personId!: string

  /** The only state this example's happy path reaches (sds.checkout.order-flow t-confirm). */
  @Column({
      type: "text", default: "confirmed" 
  })
      status!: OrderStatus

  @Column({
      type: "int", name: "total_minor_units" 
  })
      totalMinorUnits!: number

  @Column({
      type: "text", default: "USD" 
  })
      currency!: string

  /** Idempotency-Key echoed back so a replayed confirmation returns the same order. */
  @Column({
      type: "text", nullable: true, name: "idempotency_key" 
  })
      idempotencyKey!: string | null
}
