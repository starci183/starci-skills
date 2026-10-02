import type { QueueSchedulerDefinition } from "@modules/platform/queue"
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
