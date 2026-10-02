import { BaseEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

/** The payload of `order.placed` (the contract `be/contracts/order/events.json`). */
export interface OrderPlacedPayload {
    /** The placed order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The total of the order in minor units. */
    readonly totalMinorUnits: number
}

/** An order was placed: version 1 of the order service's contract; it starts the invoice of the order in billing. */
export class OrderPlacedEvent extends BaseEvent {
    static readonly eventName = "order.placed"
    static readonly version = 1

    readonly eventName = OrderPlacedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: OrderPlacedPayload,
    ) {
        super()
    }

    /** Builds the event of a placed order; its id is the order id, so a repeat is recognised by the receiver. */
    static create(payload: OrderPlacedPayload): OrderPlacedEvent {
        return new OrderPlacedEvent(payload.orderId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): OrderPlacedEvent | null {
        if (!isRecord(envelope) || typeof envelope.eventId !== "string" || !isRecord(envelope.payload)) return null
        const { orderId, personId, totalMinorUnits } = envelope.payload
        return typeof orderId === "string" && typeof personId === "string" && typeof totalMinorUnits === "number"
            ? new OrderPlacedEvent(envelope.eventId, { orderId, personId, totalMinorUnits })
            : null
    }
}
