"use server"

import { clearCart } from "../../../modules/api/cart"
import { readSessionToken } from "../../../modules/session"

/** What a clear-cart press resolves to: cleared, or the refusal the service sent. */
export type ClearCartOutcome =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: string; readonly code?: string };

/**
 * Empty the signed-in person's server-side cart - the only removal the order service exposes, so
 * this is what "remove" means on the cart surface. An anonymous press refuses honestly.
 */
export const clearCartAction = async (): Promise<ClearCartOutcome> => {
    const sessionToken = await readSessionToken()
    if (!sessionToken) {
        return { ok: false, reason: "no signed-in session", code: "SESSION_INVALID" }
    }
    const result = await clearCart(sessionToken)
    if (!result.ok) {
        return { ok: false, reason: result.reason, code: result.code }
    }
    return { ok: true }
}
