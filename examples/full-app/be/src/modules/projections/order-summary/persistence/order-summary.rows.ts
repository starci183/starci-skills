/** The facts of one order as the facts statement answers them. */
export interface OrderSummaryFactsRow {
    /** The order. */
    readonly order_id: string
    /** The buyer. */
    readonly person_id: string
    /** The lifecycle state. */
    readonly status: string
    /** The order total in minor units. */
    readonly total_minor_units: number
    /** When the order was placed. */
    readonly placed_at: Date
    /** When the order was paid, or null. */
    readonly paid_at: Date | null
    /** How many lines the order has. */
    readonly line_count: number
    /** The loyalty points the order earned. */
    readonly loyalty_points: number
}
