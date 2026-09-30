/** The columns of a payment row. */
export interface PaymentRow {
    /** The payment id. */
    id: string
    /** The paying person. */
    personId: string
    /** The order the payment settles. */
    orderId: string
    /** The captured amount in minor units. */
    amountMinorUnits: number
    /** The ledger state. */
    status: "captured"
    /** When the payment was captured. */
    createdAt: Date
}

/** A captured payment row with valid defaults and a fixed capture time; the spec overrides only what matters. */
export const paymentRow = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
    id: "pay-1",
    personId: "p-1",
    orderId: "o-1",
    amountMinorUnits: 1500,
    status: "captured",
    createdAt: new Date("2026-02-03T04:05:06.000Z"),
    ...overrides,
})
