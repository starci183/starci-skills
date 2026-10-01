/** Options of the plan capability. */
export interface PlanOptions {
    /** The price of the paid plan, in minor units of its currency. */
    readonly paidPriceMinorUnits: number
    /** The currency of the paid plan, as the gateway names it. */
    readonly paidCurrency: string
}
