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
