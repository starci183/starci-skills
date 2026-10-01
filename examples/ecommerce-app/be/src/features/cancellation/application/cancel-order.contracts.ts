/** What cancelling a rejected order takes. */
export interface CancelOrderRequest {
    /** The order whose invoice the billing service rejected. */
    readonly orderId: string
}
