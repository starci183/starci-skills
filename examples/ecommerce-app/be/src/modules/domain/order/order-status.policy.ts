import { isRecord } from "@modules/platform/primitives"
import type { RealtimeTopic } from "@modules/platform/realtime"
import type { OrderStatus, OrderStatusFrame } from "./order-status.contracts"

const ORDER_STATUSES: ReadonlyArray<string> = ["pending", "paid", "expired", "cancelled"] satisfies ReadonlyArray<OrderStatus>

/** True when a value is a push of the order status channel: an order id, a known state and the instant it changed. */
export const isOrderStatusFrame = (value: unknown): value is OrderStatusFrame =>
    isRecord(value) &&
    typeof value.orderId === "string" &&
    typeof value.status === "string" &&
    ORDER_STATUSES.includes(value.status) &&
    typeof value.changedAt === "string"

/**
 * The channel of one buyer's order. The buyer is part of the name, so a subscription built from another principal can never
 * receive these frames; the realtime door and the reactor that pushes both build the topic with this one function.
 */
export const orderStatusTopic = (buyerId: string, orderId: string): RealtimeTopic<OrderStatusFrame> => ({
    name: `order-status:${buyerId}:${orderId}`,
    accepts: isOrderStatusFrame,
})
