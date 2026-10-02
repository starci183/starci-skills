/** Options of the invoice capability. */
export interface InvoiceOptions {
    /** The largest total, in minor units, one invoice may bill; a larger order is rejected. */
    readonly maxTotalMinorUnits: number
}
