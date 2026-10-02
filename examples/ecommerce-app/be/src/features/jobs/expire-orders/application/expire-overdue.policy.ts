import type { QueueSchedulerDefinition } from "@modules/platform/queue"
import { ORDER_EXPIRY_QUEUE } from "./expire-overdue.contracts"
import type { ExpireOrdersPayload, OrderExpiryOptions } from "./expire-overdue.contracts"

/** True when a job payload is the payload of an expire-orders job. */
export const isExpireOrdersPayload = (value: unknown): value is ExpireOrdersPayload =>
    typeof value === "object" && value !== null && "olderThanMs" in value && typeof value.olderThanMs === "number"

/** The job scheduler of the expiry sweep: BullMQ fires it every `everyMs` for the whole fleet, whatever the replica count. */
export const expireOrdersSchedulerOf = (options: OrderExpiryOptions): QueueSchedulerDefinition => ({
    queue: ORDER_EXPIRY_QUEUE,
    id: "expire-pending-orders",
    everyMs: options.everyMs,
    payload: { olderThanMs: options.olderThanMs } satisfies ExpireOrdersPayload,
})
