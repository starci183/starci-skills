import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, PaymentIntentEntity } from '../../platform/databases/postgresql/primary';
import { PlanPaymentIntentNotFoundException } from '@modules/shared/exceptions';
import { PaymentIntentRecord, PaymentIntentStatus } from './types/payment-intent-record';

/**
 * data.plan.payment-intent: the idempotent ledger br.plan.payment.idempotent depends on. `id` is this
 * product's own opaque id and idempotency key; `gatewayIntentId` is SePay's own id for the same
 * transaction. `markPaidIfNotApplied` is the one write that ever sets `appliedAt`, and it sets it at most
 * once per id - a webhook (fr.plan.upgrade's t-gateway-confirmed) and a reconciliation poll
 * (fr.plan.reconcile) both call it, and whichever gets there first wins; the other's call is a no-op that
 * reports `alreadyApplied: true` instead of writing a second time.
 */
@Injectable()
export class PaymentService {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

  async create(subscriptionId: string, gatewayIntentId: string, amount: number, currency: string): Promise<PaymentIntentRecord> {
    const saved = await this.entityManager.save(PaymentIntentEntity, {
      id: randomUUID(),
      subscriptionId,
      gateway: 'sepay',
      gatewayIntentId,
      amount,
      currency,
      status: 'pending' as PaymentIntentStatus,
      appliedAt: null,
    });
    return toRecord(saved);
  }

  async findById(id: string): Promise<PaymentIntentRecord> {
    return toRecord(await this.mustFindRow(id));
  }

  async findByGatewayIntentId(gatewayIntentId: string): Promise<PaymentIntentRecord | null> {
    const row = await this.entityManager.findOneBy(PaymentIntentEntity, { gatewayIntentId });
    return row ? toRecord(row) : null;
  }

  /** br.plan.payment.idempotent / ac.plan.payment.idempotent.replay-is-noop: the first call to apply an
   * intent activates it; every later call for the same id changes nothing and reports so. */
  async markPaidIfNotApplied(id: string): Promise<{ record: PaymentIntentRecord; alreadyApplied: boolean }> {
    const row = await this.mustFindRow(id);
    if (row.appliedAt) {
      return { record: toRecord(row), alreadyApplied: true };
    }
    row.status = 'paid';
    row.appliedAt = new Date();
    const saved = await this.entityManager.save(PaymentIntentEntity, row);
    return { record: toRecord(saved), alreadyApplied: false };
  }

  /** fr.plan.reconcile: the gateway shows the intent failed or expired. Never overturns an intent already
   * applied - an idempotent ledger entry is never revoked once written. */
  async markFailed(id: string): Promise<PaymentIntentRecord> {
    const row = await this.mustFindRow(id);
    if (row.appliedAt) {
      return toRecord(row);
    }
    row.status = 'failed';
    const saved = await this.entityManager.save(PaymentIntentEntity, row);
    return toRecord(saved);
  }

  private async mustFindRow(id: string): Promise<PaymentIntentEntity> {
    const row = await this.entityManager.findOneBy(PaymentIntentEntity, { id });
    if (!row) {
      throw new PlanPaymentIntentNotFoundException({ intentId: id });
    }
    return row;
  }
}

function toRecord(row: PaymentIntentEntity): PaymentIntentRecord {
  return new PaymentIntentRecord(
    row.id,
    row.subscriptionId,
    row.gateway,
    row.gatewayIntentId,
    row.amount,
    row.currency,
    row.status as PaymentIntentStatus,
    row.appliedAt,
  );
}
