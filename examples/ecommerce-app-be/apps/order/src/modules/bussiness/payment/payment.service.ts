import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PaymentEntity } from '../../platform/databases/postgresql/primary';

export interface PaymentResult {
  paymentId: string;
  status: 'captured';
  amountMinorUnits: number;
}

/**
 * The internal payment ledger - sds.checkout.order-flow t-pay. There is no external PSP in this
 * example, and therefore deliberately no integration node for one: a real gateway would be
 * declared (extensions.work3.integrations + a work/integration record) before it is called.
 * This module is the seam such a gateway plugs into. It writes inside the caller's transaction
 * (it takes the EntityManager, it does not open one), and the capture is keyed by the order id,
 * so a confirmation can never be paid twice.
 */
@Injectable()
export class PaymentService {
  async capture(manager: EntityManager, personId: string, orderId: string, amountMinorUnits: number): Promise<PaymentResult> {
    const payment = new PaymentEntity();
    payment.personId = personId;
    payment.orderId = orderId;
    payment.amountMinorUnits = amountMinorUnits;
    payment.idempotencyKey = orderId;
    payment.status = 'captured';
    const saved = await manager.getRepository(PaymentEntity).save(payment);
    return { paymentId: saved.id, status: saved.status, amountMinorUnits: saved.amountMinorUnits };
  }
}
