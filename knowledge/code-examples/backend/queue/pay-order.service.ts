import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ReceiptQueue } from "@modules/queues/receipt"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { PaymentEntity } from "./persistence/entities/payment.entity"

@Injectable()
/** A domain service that starts background work as part of its own change. */
export class PaymentService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly receiptQueue: ReceiptQueue,
    ) {}

    /** Settles the payment and queues its receipt in one transaction. */
    async settle(payment: PaymentEntity): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await manager.save(payment)
            await this.receiptQueue.enqueueSendReceipt({ orderId: payment.orderId }, manager)
        })
    }
}
