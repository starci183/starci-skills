import type { GetBuyerStatusResult } from "../order.contracts"

/** The row INSERT_ORDER_IF_NEW answers. */
export interface OrderIdRow {
    /** The new order id. */
    id: string
}

/** The row COUNT_PERSON_ORDERS answers. */
export interface OrderCountRow {
    /** How many orders the person has. */
    order_count: number
}

/** The id of the inserted order, or null when the idempotency key was already used (no row). */
export const toOrderId = (rows: ReadonlyArray<OrderIdRow>): string | null => rows[0]?.id ?? null

/** Whether the person is a buyer, from the count row (no row counts as zero orders). */
export const toBuyerStatus = (personId: string, rows: ReadonlyArray<OrderCountRow>): GetBuyerStatusResult => ({
    personId,
    hasOrders: (rows[0]?.order_count ?? 0) > 0,
})
