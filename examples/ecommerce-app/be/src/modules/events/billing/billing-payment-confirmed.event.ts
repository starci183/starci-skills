import { BaseEvent, readEventOf } from "@modules/platform/event-bus"
import type { ParsedEvent } from "@modules/platform/event-bus"

/** The payload of `billing.payment-confirmed` (the contract `be/contracts/billing/events.json`). */
export interface PaymentConfirmedPayload {
    /** The order whose invoice was paid. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The paid amount in minor units. */
    readonly totalMinorUnits: number
}

/** True when the payload record has the fields and types of the payload. */
const isPaymentConfirmedPayload = (
    payload: Record<string, unknown>,
): payload is Record<string, unknown> & PaymentConfirmedPayload =>
    typeof payload.orderId === "string" &&
    typeof payload.personId === "string" &&
    typeof payload.totalMinorUnits === "number"

/** A bank transfer paid an invoice in full: version 1 of the billing service's contract; the order service marks the order paid. */
export class PaymentConfirmedEvent extends BaseEvent {
    static readonly eventName = "billing.payment-confirmed"
    static readonly version = 1

    readonly eventName = PaymentConfirmedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: PaymentConfirmedPayload,
    ) {
        super()
    }

    /** Builds the event; its id is the order id (an invoice is paid once), so a repeat is recognised by the receiver. */
    static create(payload: PaymentConfirmedPayload): PaymentConfirmedEvent {
        return new PaymentConfirmedEvent(payload.orderId, payload)
    }

    /** Reads a received envelope `{ eventId, payload }` back into the event; null when it does not have the shape. */
    static parse(envelope: unknown): ParsedEvent<PaymentConfirmedEvent> {
        return readEventOf(
            envelope,
            isPaymentConfirmedPayload,
            (eventId, payload) => new PaymentConfirmedEvent(eventId, payload),
        )
    }
}
