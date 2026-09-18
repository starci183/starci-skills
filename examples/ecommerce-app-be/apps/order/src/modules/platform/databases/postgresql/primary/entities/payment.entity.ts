import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payment')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'person_id' })
  personId!: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @Column({ type: 'int', name: 'amount_minor_units' })
  amountMinorUnits!: number;

  /** This example has no external PSP (that would be an integration node it does not have);
   * the payment module is the internal ledger seam a real gateway plugs into. */
  @Column({ type: 'text', default: 'captured' })
  status!: 'captured';

  @Column({ type: 'text', unique: true, name: 'idempotency_key' })
  idempotencyKey!: string;
}
