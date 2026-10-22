import { BaseEvent, readEnvelope } from "@modules/platform/event-bus"
import type { ParsedEvent } from "@modules/platform/event-bus"

/** The payload of `billing.invoice-rejected` (the contract `be/contracts/billing/events.json`). */
export interface InvoiceRejectedPayload {
    /** The order whose invoice was rejected. */
    readonly orderId: string
    /** Why the invoice was rejected. */
    readonly reason: string
    /** The amount that was refused, in minor units. */
    readonly totalMinorUnits: number
}

/** An invoice was rejected: version 1 of the billing service's contract; it compensates `order.placed`. */
export class InvoiceRejectedEvent extends BaseEvent {
    static readonly eventName = "billing.invoice-rejected"
    static readonly version = 1
    static readonly compensates = "order.placed"

    readonly eventName = InvoiceRejectedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: InvoiceRejectedPayload,
    ) {
        super()
    }

    /** Builds the event of a rejected invoice; its id is the order id, so a repeat is recognised by the receiver. */
    static create(payload: InvoiceRejectedPayload): InvoiceRejectedEvent {
        return new InvoiceRejectedEvent(payload.orderId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): ParsedEvent<InvoiceRejectedEvent> {
        const read = readEnvelope(envelope)
        if (read === null) return null
        const { orderId, reason, totalMinorUnits } = read.payload
        return typeof orderId === "string" && typeof reason === "string" && typeof totalMinorUnits === "number"
            ? new InvoiceRejectedEvent(read.eventId, { orderId, reason, totalMinorUnits })
            : null
    }
}
