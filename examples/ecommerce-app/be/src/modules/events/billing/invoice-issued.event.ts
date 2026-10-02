import { defineEvent } from "@modules/platform/event-bus"
import type { BusEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

/** The payload of `billing.invoice-issued` (the contract `be/contracts/billing/events.json`). */
export interface InvoiceIssuedPayload {
    /** The order whose invoice was issued. */
    readonly orderId: string
    /** The billed amount in minor units. */
    readonly totalMinorUnits: number
}

/** An invoice was issued: version 1 of the billing service's contract; it completes the place-order saga of the order. */
export class InvoiceIssuedEvent implements BusEvent<InvoiceIssuedPayload> {
    /** The declaration publishers and consumers share. */
    static readonly definition = defineEvent<InvoiceIssuedPayload>({
        name: "billing.invoice-issued",
        version: 1,
        attempts: 3,
        backoffMs: 1000,
        parse: (value) =>
            isRecord(value) && typeof value.orderId === "string" && typeof value.totalMinorUnits === "number"
                ? { orderId: value.orderId, totalMinorUnits: value.totalMinorUnits }
                : null,
    })

    readonly definition = InvoiceIssuedEvent.definition

    private constructor(
        readonly eventId: string,
        readonly payload: InvoiceIssuedPayload,
    ) {}

    /** Builds the event of an issued invoice; its id is the order id, so a repeat is recognised by the receiver. */
    static create(payload: InvoiceIssuedPayload): InvoiceIssuedEvent {
        return new InvoiceIssuedEvent(payload.orderId, payload)
    }
}
