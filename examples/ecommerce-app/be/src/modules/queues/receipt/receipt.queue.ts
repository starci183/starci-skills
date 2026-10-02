import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the send-receipt job. */
export const RECEIPT_QUEUE = "receipt"

/** The payload of one send-receipt job: the paid order, ids only. */
export interface SendReceiptPayload {
    /** The paid order whose receipt is archived. */
    readonly orderId: string
}

/** True when a job payload is the payload of a send-receipt job. */
export const isSendReceiptPayload = (value: unknown): value is SendReceiptPayload =>
    typeof value === "object" && value !== null && "orderId" in value && typeof value.orderId === "string"

@Injectable()
/** The typed producer of the receipt queue: the one way a send-receipt job starts. */
export class ReceiptQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the receipt of a paid order in the caller's transaction: the job exists exactly when the payment commits. */
    enqueueSendReceipt(payload: SendReceiptPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, RECEIPT_QUEUE, payload)
    }
}
