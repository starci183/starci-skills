/** What the event that reports the failure of an invoice carries: the order it is about and the id of the delivery (the inbox dedupe key). */
export interface CompensatePlaceOrderRequest {
    /** The order the saga run is about. */
    readonly orderId: string
    /** The id of the delivered event. */
    readonly eventId: string
}
