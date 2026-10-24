/** The calendar identity carried by a recorded delivery. */
export interface CalendarDelivery {
    /** The calendar provider identity. */
    readonly id: string
}

/** A pending durable calendar delivery receipt. */
export interface PendingCalendarReceipt {
    /** The inbox receipt identity. */
    readonly id: string
    /** The delivery retained until processing succeeds, as the row holds it: unread until the delivery schema parses it. */
    readonly payload: unknown
}
