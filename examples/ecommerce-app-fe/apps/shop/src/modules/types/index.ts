/** The confirmation the order service answers for a placed - or idempotently replayed - order. */
export type OrderConfirmation = {
    readonly orderId: string
    readonly status: string
    readonly totalMinorUnits: number
    readonly currency: string
    readonly paymentId: string
    readonly replayed: boolean
}

/**
 * What confirming a checkout can return. `refused` is the service's named business refusal -
 * `cart-empty`, `unknown-product`, `insufficient-stock` - carrying the refusal's own fields
 * verbatim (the product it is about, how much was asked, how much stock there was). `failed` is
 * everything else: a refused session or an unreachable service.
 *
 * There is deliberately no order-list call here: the backend's only order read surfaces are this
 * confirmation and the `hasOrders` flag the identity `account` query joins. An account page that
 * listed orders would have no door to read them through.
 */
export type PlaceOrderOutcome =
    | { readonly kind: "confirmed"; readonly confirmation: OrderConfirmation }
    | {
        readonly kind: "refused"
        readonly reason: string
        readonly productId: string
        readonly requested?: number
        readonly available?: number
    }
    | { readonly kind: "failed"; readonly reason: string; readonly code?: string };

/** One order line with every rendered string already resolved (name, quantity, line total). */
export type LineItemRow = {
    readonly productId: string
    readonly name: string
    readonly quantityLabel: string
    readonly lineTotal: string
}
