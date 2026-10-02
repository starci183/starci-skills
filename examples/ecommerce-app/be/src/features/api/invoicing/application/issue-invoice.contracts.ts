import type { InvoiceErrorCode, InvoiceView } from "@modules/domain/invoice"
import type { Outcome } from "@modules/platform/primitives"

/** What invoicing a placed order takes. */
export interface IssueInvoiceRequest {
    /** The id of the delivered event; the inbox claim and the dedupe of a redelivery are built on it. */
    readonly eventId: string
    /** The placed order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The total to bill in minor units. */
    readonly totalMinorUnits: number
}

/** The invoice that was recorded, or the refusal of an order above the billing limit. */
export type IssueInvoiceResult = Outcome<InvoiceView, InvoiceErrorCode.OverLimit>
