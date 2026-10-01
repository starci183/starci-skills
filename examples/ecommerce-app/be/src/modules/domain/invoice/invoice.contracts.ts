import { defineQueue } from "@modules/integrations/messaging"
import type { QueueSpec } from "@modules/integrations/messaging"
import { isRecord } from "@modules/platform/primitives"

/** The payload of `order.placed` as this service reads it (version 1 of the order service's contract, `be/contracts/order/events.json`). */
export interface PlacedOrderNotice {
    /** The placed order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The total of the order in minor units. */
    readonly totalMinorUnits: number
}

/** The payload of `billing.invoice-rejected` as this service publishes it (version 1 of its own contract, `be/contracts/billing/events.json`). */
export interface InvoiceRejectedPayload {
    /** The order whose invoice was rejected. */
    readonly orderId: string
    /** Why the invoice was rejected. */
    readonly reason: string
    /** The amount that was refused, in minor units. */
    readonly totalMinorUnits: number
}

/** The queue of the orders this service invoices: three deliveries, one second of backoff doubling. */
export const PLACED_ORDER_QUEUE = defineQueue<PlacedOrderNotice>({
    name: "order.placed",
    attempts: 3,
    backoffMs: 1000,
    parse: (value) =>
        isRecord(value) &&
        typeof value.orderId === "string" &&
        typeof value.personId === "string" &&
        typeof value.totalMinorUnits === "number"
            ? { orderId: value.orderId, personId: value.personId, totalMinorUnits: value.totalMinorUnits }
            : null,
})

/** The queue this service announces a rejected invoice on, for the order service to compensate. */
export const INVOICE_REJECTED_QUEUE: QueueSpec = { name: "billing.invoice-rejected", attempts: 3, backoffMs: 1000 }

/** The invoice a consumer or a read shows. */
export interface InvoiceView {
    /** The invoice id. */
    readonly invoiceId: string
    /** The order the invoice bills. */
    readonly orderId: string
    /** The billed amount in minor units. */
    readonly totalMinorUnits: number
}

/** What issuing an invoice needs: the delivery's event id and the order it announces. */
export interface IssueInvoiceParams {
    /** The stable id of the delivered event; a repeat of it changes nothing. */
    readonly eventId: string
    /** The placed order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The total to bill in minor units. */
    readonly totalMinorUnits: number
}
