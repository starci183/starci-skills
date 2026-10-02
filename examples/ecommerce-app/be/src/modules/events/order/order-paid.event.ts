import { BaseEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

/** The payload of `order.paid` (the contract `be/contracts/order/events.json`). */
export interface OrderPaidPayload {
    /** The paid order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The paid total in minor units. */
    readonly totalMinorUnits: number
    /** When the order was paid, ISO 8601. */
    readonly paidAt: string
}

/** An order was paid: version 1 of the order service's contract; it starts the loyalty grant, the order summary, the status push and the receipt. */
export class OrderPaidEvent extends BaseEvent {
    static readonly eventName = "order.paid"
    static readonly version = 1

    readonly eventName = OrderPaidEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: OrderPaidPayload,
    ) {
        super()
    }

    /** Builds the event; its id is the order id (an order is paid once), so a repeat is recognised by the receiver. */
    static create(payload: OrderPaidPayload): OrderPaidEvent {
        return new OrderPaidEvent(payload.orderId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): OrderPaidEvent | null {
        if (!isRecord(envelope) || typeof envelope.eventId !== "string" || !isRecord(envelope.payload)) return null
        const { orderId, personId, totalMinorUnits, paidAt } = envelope.payload
        return typeof orderId === "string" && typeof personId === "string" && typeof totalMinorUnits === "number" && typeof paidAt === "string"
            ? new OrderPaidEvent(envelope.eventId, { orderId, personId, totalMinorUnits, paidAt })
            : null
    }
}
