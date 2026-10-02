// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { BaseEvent } from "@modules/platform/event-bus"

/** The payload of `order.placed`: ids and amounts, never an entity. */
export interface OrderPlacedPayload {
    readonly orderId: string
    readonly personId: string
    readonly totalMinorUnits: number
}

/** An order was placed. One class per event, named after it (`order-placed.event.ts`); the vendored contract lists the same name and version. */
export class OrderPlacedEvent extends BaseEvent {
    static readonly eventName = "order.placed"
    static readonly version = 1

    constructor(
        readonly eventId: string,
        readonly payload: OrderPlacedPayload,
    ) {
        super()
    }

    /** Builds the event; the id is stable per order, so a repeat publication carries the same id. */
    static create(payload: OrderPlacedPayload): OrderPlacedEvent {
        return new OrderPlacedEvent(`order-placed:${payload.orderId}`, payload)
    }

    /** Reads a delivered payload back; null when it does not have the expected shape. */
    static parse(value: unknown): OrderPlacedEvent | null {
        const record = value as { eventId?: string; payload?: OrderPlacedPayload } | null
        return record?.eventId && record.payload ? new OrderPlacedEvent(record.eventId, record.payload) : null
    }
}
