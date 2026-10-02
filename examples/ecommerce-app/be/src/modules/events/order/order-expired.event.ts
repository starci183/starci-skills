import { BaseEvent, readEnvelope } from "@modules/platform/event-bus"
import type { ParsedEvent } from "@modules/platform/event-bus"

/** The payload of `order.expired` (the contract `be/contracts/order/events.json`). */
export interface OrderExpiredPayload {
    /** The expired order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** When the order expired, ISO 8601. */
    readonly expiredAt: string
}

/** An unpaid order expired: version 1 of the order service's contract; it starts the order summary refresh and the status push. */
export class OrderExpiredEvent extends BaseEvent {
    static readonly eventName = "order.expired"
    static readonly version = 1

    readonly eventName = OrderExpiredEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: OrderExpiredPayload,
    ) {
        super()
    }

    /** Builds the event; its id is the order id (an order expires once), so a repeat is recognised by the receiver. */
    static create(payload: OrderExpiredPayload): OrderExpiredEvent {
        return new OrderExpiredEvent(payload.orderId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): ParsedEvent<OrderExpiredEvent> {
        const read = readEnvelope(envelope)
        if (read === null) return null
        const { orderId, personId, expiredAt } = read.payload
        return typeof orderId === "string" && typeof personId === "string" && typeof expiredAt === "string"
            ? new OrderExpiredEvent(read.eventId, { orderId, personId, expiredAt })
            : null
    }
}
