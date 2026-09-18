import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, SubscriptionEntity } from '../../platform/databases/postgresql/primary';
import { PlanSubscriptionNotFoundException } from '@modules/shared/exceptions';
import { SubscriptionRecord, SubscriptionStatus } from './types/subscription-record';
import { FREE_PLAN, PAID_PLAN, PlanDefinition } from './types/plan-catalog';

/**
 * sds.plan.subscription-lifecycle: holds one row per person's plan and is the only writer of its status.
 * Method names mirror the record's own transition ids (t-checkout-started, t-gateway-confirmed, ...) so
 * the record and the code read together, the same convention SessionService and TaskService already
 * follow for their own state machines.
 *
 * `readEffectivePlan` is t-revert-on-read (br.plan.lapse.reverts-on-read): a lapsed row always reads as
 * free, computed at the moment of the read, and this method never writes - only a fresh
 * `tCheckoutStarted` ever writes a lapsed row again, per the record's own note. Every other reader of
 * "is this person paid" (the cap guard, the usage screen) is expected to call this method, never the
 * stored `status` column directly.
 *
 * The row lives in Postgres, through the platform database module's SubscriptionEntity, reached the way
 * every other capability service reaches its own row: `@InjectPrimaryEntityManager()`, no repository
 * file, no `@InjectRepository`.
 */
@Injectable()
export class SubscriptionService {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

  /** data.plan.subscription's invariant: exactly one row per personId, created lazily on first touch
   * since account creation is owned outside this feature. */
  async getOrCreate(personId: string): Promise<SubscriptionRecord> {
    const existing = await this.entityManager.findOneBy(SubscriptionEntity, { personId });
    if (existing) return toRecord(existing);
    const saved = await this.entityManager.save(SubscriptionEntity, {
      id: randomUUID(),
      personId,
      plan: 'free',
      status: 'free' as SubscriptionStatus,
      periodEnd: null,
      gatewayCustomerId: null,
    });
    return toRecord(saved);
  }

  async findById(subscriptionId: string): Promise<SubscriptionRecord> {
    return toRecord(await this.mustFindRow(subscriptionId));
  }

  /** t-revert-on-read: the computed effective plan, never the raw stored status. */
  async readEffectivePlan(personId: string): Promise<PlanDefinition> {
    const record = await this.getOrCreate(personId);
    return this.tRevertOnRead(record);
  }

  tRevertOnRead(record: SubscriptionRecord): PlanDefinition {
    if (record.status === 'active' || record.status === 'past-due') return PAID_PLAN;
    // 'free', 'pending' and 'lapsed' all read as free: pending has not been confirmed paid yet, and a
    // lapsed row reverts to free on read without ever being written (br.plan.lapse.reverts-on-read).
    return FREE_PLAN;
  }

  /** t-checkout-started: free -> pending. The owner chose the paid plan and a payment intent is about to
   * be created by the caller (fr.plan.upgrade's mainFlow). */
  async tCheckoutStarted(personId: string): Promise<SubscriptionRecord> {
    const record = await this.getOrCreate(personId);
    const row = await this.mustFindRow(record.id);
    row.status = 'pending';
    return toRecord(await this.entityManager.save(SubscriptionEntity, row));
  }

  /** t-gateway-confirmed (pending -> active) and t-renewal-confirmed (past-due -> active) share this
   * effect: periodEnd is set/extended and the plan becomes/stays paid. Distinguished by the caller, which
   * already knows which state it found the row in - both are "the gateway confirmed payment", differing
   * only in the row's starting status, exactly as the state machine records them as two transition ids
   * into the same target state. */
  async tGatewayConfirmed(subscriptionId: string, periodEnd: Date): Promise<SubscriptionRecord> {
    const row = await this.mustFindRow(subscriptionId);
    row.status = 'active';
    row.plan = 'paid';
    row.periodEnd = periodEnd;
    return toRecord(await this.entityManager.save(SubscriptionEntity, row));
  }

  async tRenewalConfirmed(subscriptionId: string, periodEnd: Date): Promise<SubscriptionRecord> {
    return this.tGatewayConfirmed(subscriptionId, periodEnd);
  }

  /** t-gateway-abandoned: pending -> free. Either the owner never completed checkout, or
   * fr.plan.reconcile polled the gateway and found the intent failed or expired. */
  async tGatewayAbandoned(subscriptionId: string): Promise<SubscriptionRecord> {
    const row = await this.mustFindRow(subscriptionId);
    row.status = 'free';
    row.plan = 'free';
    row.periodEnd = null;
    return toRecord(await this.entityManager.save(SubscriptionEntity, row));
  }

  /** t-renewal-due: active -> past-due. now is at or past periodEnd with no renewal webhook. */
  async tRenewalDue(subscriptionId: string): Promise<SubscriptionRecord> {
    const row = await this.mustFindRow(subscriptionId);
    row.status = 'past-due';
    return toRecord(await this.entityManager.save(SubscriptionEntity, row));
  }

  /** t-lapse: past-due -> lapsed. Not terminal in the sense of never read again - see tRevertOnRead. */
  async tLapse(subscriptionId: string): Promise<SubscriptionRecord> {
    const row = await this.mustFindRow(subscriptionId);
    row.status = 'lapsed';
    return toRecord(await this.entityManager.save(SubscriptionEntity, row));
  }

  /** t-downgrade: [active, past-due] -> free. decision.plan.downgrade.policy (accept-and-freeze): always
   * accepted immediately, never refused for being over the new cap, and touches no task row - that half
   * is br.plan.downgrade.freeze, enforced by the cap guard from its next create onward. A person not
   * currently active/past-due (free, pending, lapsed) has nothing to downgrade from; this is a no-op for
   * them rather than an error, since "downgrade to free" is already true or on its way to true. */
  async tDowngrade(personId: string): Promise<SubscriptionRecord> {
    const record = await this.getOrCreate(personId);
    if (record.status !== 'active' && record.status !== 'past-due') {
      return record;
    }
    const row = await this.mustFindRow(record.id);
    row.status = 'free';
    row.plan = 'free';
    row.periodEnd = null;
    return toRecord(await this.entityManager.save(SubscriptionEntity, row));
  }

  private async mustFindRow(subscriptionId: string): Promise<SubscriptionEntity> {
    const row = await this.entityManager.findOneBy(SubscriptionEntity, { id: subscriptionId });
    if (!row) {
      throw new PlanSubscriptionNotFoundException({ subscriptionId });
    }
    return row;
  }
}

function toRecord(row: SubscriptionEntity): SubscriptionRecord {
  return new SubscriptionRecord(row.id, row.personId, row.plan, row.status as SubscriptionStatus, row.periodEnd, row.gatewayCustomerId);
}
