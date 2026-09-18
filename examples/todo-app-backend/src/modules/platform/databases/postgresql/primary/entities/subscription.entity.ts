import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * data.plan.subscription: exactly one row per personId; status is authored by
 * sds.plan.subscription-lifecycle's transitions only, and periodEnd is set if and only if status is
 * active or past-due. This is the TypeORM shape of that row, owned by the platform database module.
 */
@Entity({ name: 'subscriptions' })
export class SubscriptionEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { name: 'person_id', unique: true })
  personId!: string;

  @Column('text', { default: 'free' })
  plan!: string;

  @Column('text', { default: 'free' })
  status!: string;

  @Column('timestamptz', { name: 'period_end', nullable: true })
  periodEnd!: Date | null;

  @Column('text', { name: 'gateway_customer_id', nullable: true })
  gatewayCustomerId!: string | null;
}
