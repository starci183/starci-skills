/** The projection's public read surface; storage columns stay inside persistence. */
export interface OrderSummary {
    readonly buyerId: string
    readonly orderCount: number
}
