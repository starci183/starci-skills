/** The columns of an invoice row. */
export interface InvoiceRow {
    /** The invoice id. */
    id: string
    /** The order the invoice bills. */
    orderId: string
    /** The buyer. */
    personId: string
    /** The billed amount in minor units. */
    totalMinorUnits: number
    /** The invoice state. */
    status: "issued" | "rejected"
    /** When the invoice was recorded. */
    createdAt: Date
}

/** An issued invoice row with valid defaults and a fixed time; the spec overrides only what matters. */
export const invoiceRow = (overrides: Partial<InvoiceRow> = {}): InvoiceRow => ({
    id: "inv-1",
    orderId: "o-1",
    personId: "p-1",
    totalMinorUnits: 1500,
    status: "issued",
    createdAt: new Date("2026-02-03T04:05:06.000Z"),
    ...overrides,
})
