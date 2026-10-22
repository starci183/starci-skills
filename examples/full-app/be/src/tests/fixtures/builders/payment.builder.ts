/** The columns of a payment row. */
export interface PaymentRow {
    /** The payment id. */
    id: string
    /** The invoice the transfer paid. */
    invoiceId: string
    /** The order the payment settles. */
    orderId: string
    /** The paying person. */
    personId: string
    /** The transferred amount in minor units. */
    amountMinorUnits: number
    /** The bank reference of the transfer. */
    providerReference: string
    /** When the payment was recorded. */
    createdAt: Date
}

/** A payment row with valid defaults and a fixed time; the spec overrides only what matters. */
export const paymentRow = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
    id: "pay-1",
    invoiceId: "inv-1",
    orderId: "o-1",
    personId: "p-1",
    amountMinorUnits: 1500,
    providerReference: "FT0000092704",
    createdAt: new Date("2026-02-03T04:05:06.000Z"),
    ...overrides,
})
