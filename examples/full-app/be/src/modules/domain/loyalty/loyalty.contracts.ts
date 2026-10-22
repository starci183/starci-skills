/** What granting the loyalty points of a paid order needs: the delivery's event id and the paid order. */
export interface GrantLoyaltyParams {
    /** The stable id of the delivered event; a repeat of it changes nothing. */
    readonly eventId: string
    /** The paid order. */
    readonly orderId: string
    /** The buyer who earns the points. */
    readonly personId: string
    /** What the buyer paid, in minor units. */
    readonly totalMinorUnits: number
}

/** How many minor units earn one loyalty point. */
export const MINOR_UNITS_PER_POINT = 100
