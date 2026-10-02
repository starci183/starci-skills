import { defineEvent } from "@modules/platform/event-bus"
import type { BusEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

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
export class InvoiceRejectedEvent implements BusEvent<InvoiceRejectedPayload> {
    /** The declaration publishers and consumers share. */
    static readonly definition = defineEvent<InvoiceRejectedPayload>({
        name: "billing.invoice-rejected",
        version: 1,
        attempts: 3,
        backoffMs: 1000,
        parse: (value) =>
            isRecord(value) &&
            typeof value.orderId === "string" &&
            typeof value.reason === "string" &&
            typeof value.totalMinorUnits === "number"
                ? { orderId: value.orderId, reason: value.reason, totalMinorUnits: value.totalMinorUnits }
                : null,
    })

    readonly definition = InvoiceRejectedEvent.definition

    private constructor(
        readonly eventId: string,
        readonly payload: InvoiceRejectedPayload,
    ) {}

    /** Builds the event of a rejected invoice; its id is the order id, so a repeat is recognised by the receiver. */
    static create(payload: InvoiceRejectedPayload): InvoiceRejectedEvent {
        return new InvoiceRejectedEvent(payload.orderId, payload)
    }
}
