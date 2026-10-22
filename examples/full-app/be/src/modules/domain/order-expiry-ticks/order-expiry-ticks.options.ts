/** The payment window shared by scheduled and manual expiry jobs. */
export interface OrderExpiryTicksOptions {
    /** Age in milliseconds after which a pending order is eligible for expiry. */
    readonly olderThanMs: number
}
