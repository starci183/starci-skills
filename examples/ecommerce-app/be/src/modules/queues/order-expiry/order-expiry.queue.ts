import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox, QueueSchedulerDefinition } from "@modules/platform/queue"
import type { ExpireOrdersPayload, OrderExpiryOptions } from "./order-expiry.contracts"

/** The queue name: the contract between this producer, its scheduler and the processor of the expire-orders job. */
export const ORDER_EXPIRY_QUEUE = "order-expiry"

/** The default time a pending order waits for its payment before it expires, in milliseconds. */
export const ORDER_PAYMENT_WINDOW_MS = 3_600_000

/** True when a job payload is the payload of an expire-orders job. */
export const isExpireOrdersPayload = (value: unknown): value is ExpireOrdersPayload =>
    typeof value === "object" && value !== null && "olderThanMs" in value && typeof value.olderThanMs === "number"

/** The job scheduler of the expiry sweep: BullMQ fires it every `everyMs` for the whole fleet, whatever the replica count. */
export const orderExpirySchedulerOf = (options: OrderExpiryOptions): QueueSchedulerDefinition => ({
    queue: ORDER_EXPIRY_QUEUE,
    id: "expire-pending-orders",
    everyMs: options.everyMs,
    payload: { olderThanMs: options.olderThanMs } satisfies ExpireOrdersPayload,
})

@Injectable()
/** The typed producer of the order-expiry queue, for a sweep an operator starts by hand; the scheduler starts the regular one. */
export class OrderExpiryQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues one expiry sweep in the caller's transaction. */
    enqueueExpireOverdue(payload: ExpireOrdersPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, ORDER_EXPIRY_QUEUE, payload)
    }
}
