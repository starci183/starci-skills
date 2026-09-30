import "server-only"
import { ORDER_API_URL } from "../config"
import { postGraphql } from "../api"
import type { OrderConfirmation, PlaceOrderOutcome } from "../types"

const PLACE_ORDER_MUTATION = `mutation ShopPlaceOrder($input: PlaceOrderInput!) {
    placeOrder(request: $input) { orderId status totalMinorUnits currency paymentId replayed }
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
