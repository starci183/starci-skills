"use server"

import { placeOrder } from "../../../modules/api/orders"
import type { PlaceOrderOutcome } from "../../../modules/api/orders"
import { readSessionToken } from "../../../modules/session"

/**
 * Send the rendered confirmation to the order service's `placeOrder` with its idempotency key.
 * The same key returns the first answer (replayed) rather than a second order; an anonymous press
 * refuses honestly - there is no session to confirm under.
 */
export const placeOrderAction = async (idempotencyKey: string): Promise<PlaceOrderOutcome> => {
    const sessionToken = await readSessionToken()
    if (!sessionToken) {
        return { kind: "failed", reason: "no signed-in session", code: "SESSION_INVALID" }
    }
    return placeOrder(sessionToken, idempotencyKey)
}
