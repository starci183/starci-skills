// Imports the host resolves:
//   import { Injectable } from "@nestjs/common"
//   import type { EntityManager } from "typeorm"
//   import { InjectPaymentEntityManager } from "@modules/platform/database"
//   import { InjectEventBus } from "@modules/platform/event-bus"
//   import type { EventBus } from "@modules/platform/event-bus"
//   import { PaymentSettledEvent } from "@modules/events/payment"
//   import { SETTLE_PAYMENT } from "./persistence/payment.sql"

@Injectable()
/** The payment rules: one transaction on the payment connection, the event published inside it. */
export class PaymentService {
    constructor(
        @InjectPaymentEntityManager() private readonly entityManager: EntityManager,
        @InjectEventBus() private readonly eventBus: EventBus,
    ) {}

    /** Settles the payment and tells the other contexts, atomically: both commit or neither does. */
    async settle(paymentId: string, orderId: string): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await manager.query(SETTLE_PAYMENT, [paymentId])
            await this.eventBus.publish(PaymentSettledEvent.create(paymentId, { orderId }), manager)
        })
    }
}
