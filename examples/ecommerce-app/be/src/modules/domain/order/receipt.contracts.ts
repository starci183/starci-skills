/** The receipt document of a paid order, ready to be stored: its object key and its exact bytes. */
export interface PreparedReceipt {
    /** The object key, `receipts/<order id>.json`; the same for every attempt, so storing it again replaces the same object. */
    readonly key: string
    /** The JSON document. */
    readonly content: Buffer
}

/** What recording an archived receipt takes. */
export interface RecordReceiptArchivedParams {
    /** The order whose receipt was stored. */
    readonly orderId: string
    /** The object key it was stored under. */
    readonly key: string
}
