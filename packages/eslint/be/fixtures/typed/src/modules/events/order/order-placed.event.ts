import { BaseEvent } from "@modules/platform/event-bus"

/** The order was placed. */
export class OrderPlacedEvent extends BaseEvent {
    static readonly eventName = "order.placed"
    static readonly version = 1
    constructor(readonly eventId: string, readonly orderId: string) {
        super()
    }

    /** Reads a stored payload back. */
    static parse(value: unknown): OrderPlacedEvent | null {
        const record = value as { eventId?: string; orderId?: string } | null
        return record?.eventId && record.orderId ? new OrderPlacedEvent(record.eventId, record.orderId) : null
    }
}
