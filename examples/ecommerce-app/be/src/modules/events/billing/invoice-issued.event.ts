import { BaseEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

/** The payload of `billing.invoice-issued` (the contract `be/contracts/billing/events.json`). */
export interface InvoiceIssuedPayload {
    /** The order whose invoice was issued. */
    readonly orderId: string
    /** The billed amount in minor units. */
    readonly totalMinorUnits: number
}

/** An invoice was issued: version 1 of the billing service's contract; it completes the place-order saga of the order. */
export class InvoiceIssuedEvent extends BaseEvent {
    static readonly eventName = "billing.invoice-issued"
    static readonly version = 1

    readonly eventName = InvoiceIssuedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: InvoiceIssuedPayload,
    ) {
        super()
    }

    /** Builds the event of an issued invoice; its id is the order id, so a repeat is recognised by the receiver. */
    static create(payload: InvoiceIssuedPayload): InvoiceIssuedEvent {
        return new InvoiceIssuedEvent(payload.orderId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): InvoiceIssuedEvent | null {
        if (!isRecord(envelope) || typeof envelope.eventId !== "string" || !isRecord(envelope.payload)) return null
        const { orderId, totalMinorUnits } = envelope.payload
        return typeof orderId === "string" && typeof totalMinorUnits === "number"
            ? new InvoiceIssuedEvent(envelope.eventId, { orderId, totalMinorUnits })
            : null
    }
}
