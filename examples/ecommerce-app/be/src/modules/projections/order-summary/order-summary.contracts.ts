/** The summary of one order as a reader sees it: the order, its state and what it earned. */
export interface OrderSummaryView {
    /** The order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The lifecycle state of the order. */
    readonly status: string
    /** The order total in minor units. */
    readonly totalMinorUnits: number
    /** How many lines the order has. */
    readonly lineCount: number
    /** The loyalty points the paid order earned; zero until they are granted. */
    readonly loyaltyPoints: number
    /** When the order was placed, ISO 8601. */
    readonly placedAt: string
    /** When the order was paid, ISO 8601, or null while it is not. */
    readonly paidAt: string | null
}

/** The summary of an order, or null when none was computed. */
export type GetOrderSummaryResult = OrderSummaryView | null

/** What reading the summaries of one buyer takes. */
export interface GetOrderSummariesOfPersonParams {
    /** The buyer. */
    readonly personId: string
    /** The most summaries to answer, newest first. */
    readonly limit: number
}

/** How many orders one replay step recomputes at most, so a long history is rebuilt in bounded statements. */
export const REPLAY_BATCH = 500
