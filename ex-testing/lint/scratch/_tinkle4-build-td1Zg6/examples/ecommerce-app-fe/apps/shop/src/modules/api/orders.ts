import "server-only"
import { ORDER_API_URL } from "../config"
import { postGraphql } from "./graphql"

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

const PLACE_ORDER_MUTATION = `mutation ShopPlaceOrder($input: PlaceOrderInput!) {
    placeOrder(input: $input) { orderId status totalMinorUnits currency paymentId replayed }
}`

/**
 * Confirm the person's cart into an order. The idempotency key travels in the mutation input -
 * the same key returns the first answer with `replayed: true` rather than writing a second order.
 */
export const placeOrder = async (
    sessionToken: string,
    idempotencyKey: string,
): Promise<PlaceOrderOutcome> => {
    const result = await postGraphql<{ placeOrder: OrderConfirmation }>(
        ORDER_API_URL, PLACE_ORDER_MUTATION, { input: { idempotencyKey } }, sessionToken)
    if (result.ok) {
        return { kind: "confirmed", confirmation: result.data.placeOrder }
    }
    if (result.code === "CHECKOUT_REFUSAL") {
        const extensions = result.extensions ?? {}
        return {
            kind: "refused",
            reason: typeof extensions.reason === "string" ? extensions.reason : result.reason,
            productId: typeof extensions.productId === "string" ? extensions.productId : "",
            requested: typeof extensions.requested === "number" ? extensions.requested : undefined,
            available: typeof extensions.available === "number" ? extensions.available : undefined,
        }
    }
    return { kind: "failed", reason: result.reason, code: result.code }
}
