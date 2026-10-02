/** What granting the loyalty points of a paid order takes. */
export interface GrantLoyaltyPointsRequest {
    /** The id of the delivered event; the inbox claim and the dedupe of a redelivery are built on it. */
    readonly eventId: string
    /** The paid order. */
    readonly orderId: string
    /** The buyer who earns the points. */
    readonly personId: string
    /** What the buyer paid, in minor units. */
    readonly totalMinorUnits: number
}

/** The command answers nothing: its effect is the state the domain service wrote. */
export type GrantLoyaltyPointsResult = void
