import type { PlacedOrder } from "@modules/domain/order"

/** The columns of an order row. */
export interface OrderRow {
    /** The order id. */
    id: string
    /** The buyer. */
    personId: string
    /** The lifecycle state. */
    status: "confirmed"
    /** The order total in minor units. */
    totalMinorUnits: number
    /** The ISO currency code. */
    currency: string
    /** The replay key the confirmation carried, when it had one. */
    idempotencyKey: string | null
    /** When the order was confirmed. */
    createdAt: Date
}

/** A confirmed order row with valid defaults and a fixed creation time; the spec overrides only what matters. */
export const orderRow = (overrides: Partial<OrderRow> = {}): OrderRow => ({
    id: "o-1",
    personId: "p-1",
    status: "confirmed",
    totalMinorUnits: 1250,
    currency: "USD",
    idempotencyKey: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
})

/** The confirmed order the doors answer, with valid defaults. */
export const placedOrder = (overrides: Partial<PlacedOrder> = {}): PlacedOrder => ({
    orderId: "o-1",
    status: "confirmed",
    totalMinorUnits: 1250,
    currency: "USD",
    paymentId: "pay-1",
    replayed: false,
    ...overrides,
})
