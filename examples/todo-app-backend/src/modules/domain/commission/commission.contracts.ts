/** A referral commission as callers see it: one accrual per paid payment. */
export interface CommissionView {
    /** The accrual id. */
    readonly id: string
    /** The person who referred the buyer and earns the commission. */
    readonly referrerId: string
    /** The person who paid. */
    readonly buyerId: string
    /** The payment the commission accrued on; at most one accrual exists per payment. */
    readonly paymentId: string
    /** The commission in minor units of the payment currency. */
    readonly amount: number
    /** When the commission accrued. */
    readonly accruedAt: Date
}

/** What accruing the commission of one paid payment needs. */
export interface AccrueParams {
    /** The person who referred the buyer. */
    readonly referrerId: string
    /** The person who paid. */
    readonly buyerId: string
    /** The paid payment. */
    readonly paymentId: string
    /** The amount paid, in minor units. */
    readonly paidMinorUnits: number
    /** The commission rate in basis points of the paid amount, from the options of the capability. */
    readonly bps: number
}
