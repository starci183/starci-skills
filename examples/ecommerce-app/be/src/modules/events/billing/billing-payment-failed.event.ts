import { BaseEvent, readEnvelope } from "@modules/platform/event-bus"
import type { ParsedEvent } from "@modules/platform/event-bus"

/** The payload of `billing.payment-failed` (the contract `be/contracts/billing/events.json`). */
export interface PaymentFailedPayload {
    /** The order whose invoice the transfer named. */
    readonly orderId: string
    /** Why the transfer did not pay it (`amount-mismatch`). */
    readonly reason: string
    /** The invoice total in minor units. */
    readonly expectedMinorUnits: number
    /** The amount that was transferred in minor units. */
    readonly receivedMinorUnits: number
}

/** A bank transfer did not pay an invoice: version 1 of the billing service's contract; the invoice stays open. */
export class PaymentFailedEvent extends BaseEvent {
    static readonly eventName = "billing.payment-failed"
    static readonly version = 1

    readonly eventName = PaymentFailedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: PaymentFailedPayload,
    ) {
        super()
    }

    /** Builds the event; its id is the order id and the received amount (the same wrong transfer repeats to the same id), so a repeat is recognised by the receiver. */
    static create(payload: PaymentFailedPayload): PaymentFailedEvent {
        return new PaymentFailedEvent(`${payload.orderId}:${payload.receivedMinorUnits}`, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): ParsedEvent<PaymentFailedEvent> {
        const read = readEnvelope(envelope)
        if (read === null) return null
        const { orderId, reason, expectedMinorUnits, receivedMinorUnits } = read.payload
        return typeof orderId === "string" &&
            typeof reason === "string" &&
            typeof expectedMinorUnits === "number" &&
            typeof receivedMinorUnits === "number"
            ? new PaymentFailedEvent(read.eventId, { orderId, reason, expectedMinorUnits, receivedMinorUnits })
            : null
    }
}
