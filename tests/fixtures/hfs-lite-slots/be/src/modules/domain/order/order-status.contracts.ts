import type { RealtimeTopic } from "@modules/platform/realtime"

/** A buyer receives only status frames for their orders. */
export interface OrderStatusFrame {
    readonly id: string
}

/** Both the reactor and socket door use the principal scoped topic. */
export const orderStatusTopic = (buyerId: string): RealtimeTopic<OrderStatusFrame> => ({
    name: `order-status:${buyerId}`,
    accepts: (frame: unknown): frame is OrderStatusFrame => typeof frame === "object" && frame !== null && "id" in frame && typeof frame.id === "string",
})
