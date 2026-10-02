import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the job. */
export const RECEIPT_QUEUE = "receipt"

/** The payload of one receipt job: ids only. */
export interface SendReceiptPayload {
    readonly orderId: string
}

@Injectable()
/** The typed producer of the receipt queue. */
export class ReceiptQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues a receipt in the caller's transaction: the job exists exactly when the payment commits. */
    enqueueSendReceipt(payload: SendReceiptPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, RECEIPT_QUEUE, payload)
    }
}
