/** Fixture: an owner's log events. */
export enum OrderLogEvent {
    /** A checkout failed. */
    CheckoutFailed = "order.checkout.failed",
    /** A checkout was retried. */
    CheckoutRetried = "order.checkout.retried",
}
