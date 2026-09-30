/** Upgrading the plan of the caller takes no input. */
export type UpgradePlanRequest = Readonly<Record<string, never>>

/** Where the checkout stands after it was opened. */
export interface UpgradePlanResult {
    /** The subscription of the caller. */
    readonly subscriptionId: string
    /** The payment intent to reconcile later. */
    readonly paymentIntentId: string
    /** Where the caller completes the payment. */
    readonly checkoutUrl: string
    /** The subscription status after the checkout started: pending. */
    readonly status: string
}
