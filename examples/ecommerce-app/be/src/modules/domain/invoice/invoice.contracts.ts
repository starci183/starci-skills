import type { EntityManager } from "typeorm"

/** The invoice a consumer or a read shows. */
export interface InvoiceView {
    /** The invoice id. */
    readonly invoiceId: string
    /** The order the invoice bills. */
    readonly orderId: string
    /** The buyer the invoice is for. */
    readonly personId: string
    /** The billed amount in minor units. */
    readonly totalMinorUnits: number
}

/** What the payment intake needs to find the open invoice of an order: the order a transfer names, read in the intake's transaction. */
export interface FindOpenInvoiceParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The order a transfer names. */
    readonly orderId: string
}

/** The issued, still unpaid invoice of an order, or null when the order has none. */
export type FindOpenInvoiceResult = InvoiceView | null

/** What marking an invoice paid needs; the write joins the caller transaction. */
export interface MarkInvoicePaidParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The order whose invoice a transfer paid. */
    readonly orderId: string
    /** When the transfer was recorded. */
    readonly paidAt: Date
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
