/** The payment window shared by scheduled and manual expiry jobs. */
export interface OrderExpiryTicksOptions {
    readonly olderThanMs: number
}
