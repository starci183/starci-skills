import type { PlacedOrder } from "@modules/domain/order"

/** The columns of an order row. */
export interface OrderRow {
    /** The order id. */
    id: string
    /** The buyer. */
    personId: string
    /** The lifecycle state. */
    status: "pending" | "paid" | "expired" | "cancelled"
    /** The order total in minor units. */
    totalMinorUnits: number
    /** The ISO currency code. */
    currency: string
    /** The replay key the confirmation carried, when it had one. */
    idempotencyKey: string | null
    /** The object key of the archived receipt, when it is stored. */
    receiptKey: string | null
    /** When the order was confirmed. */
    createdAt: Date
    /** When a bank transfer paid the order; null until then. */
    paidAt: Date | null
}

/** A confirmed order row with valid defaults and a fixed creation time; the spec overrides only what matters. */
export const orderRow = (overrides: Partial<OrderRow> = {}): OrderRow => ({
    id: "o-1",
    personId: "p-1",
    status: "pending",
    totalMinorUnits: 1250,
    currency: "USD",
    idempotencyKey: null,
    receiptKey: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    paidAt: null,
    ...overrides,
})

/** The columns of an order line row. */
export interface OrderLineRow {
    /** The line id. */
    id: string
    /** The order the line belongs to. */
    orderId: string
    /** The SKU. */
    productId: string
    /** How many units were sold. */
    quantity: number
    /** The unit price captured at confirmation, in minor units. */
    unitPriceMinorUnits: number
}

/** An order line row with valid defaults; the spec overrides only what matters. */
export const orderLineRow = (overrides: Partial<OrderLineRow> = {}): OrderLineRow => ({
    id: "l-1",
    orderId: "o-1",
    productId: "sku-1",
    quantity: 2,
    unitPriceMinorUnits: 500,
    ...overrides,
})

/** The confirmed order the doors answer, with valid defaults. */
export const placedOrder = (overrides: Partial<PlacedOrder> = {}): PlacedOrder => ({
    orderId: "o-1",
    status: "pending",
    totalMinorUnits: 1250,
    currency: "USD",
    replayed: false,
    ...overrides,
})
