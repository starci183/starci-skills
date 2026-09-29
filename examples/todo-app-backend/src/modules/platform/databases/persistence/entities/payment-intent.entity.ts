import {
    Column, Entity, PrimaryColumn 
} from "typeorm"

/**
 * data.plan.payment-intent: never deleted, the audit trail for a subscription's activations. appliedAt
 * is set at most once per id - br.plan.payment.idempotent's guard. This is the TypeORM shape of that
 * row, owned by the platform database module.
 */
@Entity({
    name: "payment_intents" 
})
/** TypeORM entity mapped to the payment intent row on the primary database; services reach it through the entity manager, not a repository. */
export class PaymentIntentEntity {
  @PrimaryColumn("text")
      id!: string

  @Column("text",
      {
          name: "subscription_id" 
      })
      subscriptionId!: string

  @Column("text",
      {
          default: "sepay" 
      })
      gateway!: string

  @Column("text",
      {
          name: "gateway_intent_id" 
      })
      gatewayIntentId!: string

  @Column("integer")
      amount!: number

  @Column("text",
      {
          default: "VND" 
      })
      currency!: string

  @Column("text",
      {
          default: "pending" 
      })
      status!: string

  @Column("timestamptz",
      {
          name: "applied_at", nullable: true 
      })
      appliedAt!: Date | null
}
