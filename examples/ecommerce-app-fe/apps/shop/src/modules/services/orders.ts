import "server-only"
import { parseOutcome, requestGraphql, type Outcome } from "@ecommerce/api"
import { ORDER_API_URL } from "../config"
import { toOrderConfirmation } from "../order"
import type { OrderConfirmation } from "../types"
import { DOCUMENTS } from "./__generated__/documents"

/**
 * Confirm the person's cart into an order. The idempotency key travels in the mutation input -
 * the same key returns the first answer with `replayed: true` rather than writing a second order.
 * A named refusal (`CHECKOUT_REFUSAL`: cart-empty, unknown-product, insufficient-stock) comes back
 * as an `invalid` Outcome carrying the refusal's own fields.
 */
export const placeOrder = async (sessionToken: string, idempotencyKey: string): Promise<Outcome<OrderConfirmation>> =>
    parseOutcome(
        await requestGraphql({
            baseUrl: ORDER_API_URL,
            document: DOCUMENTS.ShopPlaceOrder,
            variables: { input: { idempotencyKey } },
            token: sessionToken,
        }),
        toOrderConfirmation,
    )
