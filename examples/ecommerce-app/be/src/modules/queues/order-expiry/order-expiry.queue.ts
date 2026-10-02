import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox, QueueSchedulerDefinition } from "@modules/platform/queue"

/** The queue name: the contract between this producer, its scheduler and the processor of the expire-orders job. */
export const ORDER_EXPIRY_QUEUE = "order-expiry"

/** How long a pending order waits for its payment before it expires, in milliseconds. */
export const ORDER_PAYMENT_WINDOW_MS = 3_600_000

/** The payload of one expire-orders job: orders pending for longer than this expire. */
export interface ExpireOrdersPayload {
    /** The payment window in milliseconds. */
    readonly olderThanMs: number
}

/** True when a job payload is the payload of an expire-orders job. */
export const isExpireOrdersPayload = (value: unknown): value is ExpireOrdersPayload =>
    typeof value === "object" && value !== null && "olderThanMs" in value && typeof value.olderThanMs === "number"

/** The job scheduler of the expiry sweep: BullMQ fires it once a minute for the whole fleet, whatever the replica count. */
export const ORDER_EXPIRY_SCHEDULER: QueueSchedulerDefinition = {
    queue: ORDER_EXPIRY_QUEUE,
    id: "expire-pending-orders",
    everyMs: 60_000,
    payload: { olderThanMs: ORDER_PAYMENT_WINDOW_MS },
}

@Injectable()
/** The typed producer of the order-expiry queue, for a sweep an operator starts by hand; the scheduler starts the regular one. */
export class OrderExpiryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues one expiry sweep in the caller's transaction. */
    enqueueExpireOverdue(payload: ExpireOrdersPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, ORDER_EXPIRY_QUEUE, payload)
    }
}
