/** What recomputing the summary of an order takes. */
export interface RecomputeOrderSummaryRequest {
    /** The id of the delivered event, kept for the trace: a recompute is idempotent and needs no claim. */
    readonly eventId: string
    /** The order whose summary is recomputed. */
    readonly orderId: string
}

/** The command answers nothing: its effect is the state the domain service wrote. */
export type RecomputeOrderSummaryResult = void
