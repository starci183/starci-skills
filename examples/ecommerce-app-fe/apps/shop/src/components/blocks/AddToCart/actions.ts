"use server"

import { addCartItem } from "../../../modules/api/cart"
import { readSessionToken } from "../../../modules/session"

/** What an add-to-cart press resolves to: the line's new quantity, or the refusal the service sent. */
export type AddToCartOutcome =
    | { readonly ok: true; readonly quantity: number }
    | { readonly ok: false; readonly reason: string; readonly code?: string };

/**
 * Add one of a product to the signed-in person's server-side cart. An anonymous press refuses
 * honestly - there is no client-side cart to pretend with - and a refused session surfaces the
 * same `SESSION_INVALID` the order service answered.
 */
export const addToCart = async (productId: string): Promise<AddToCartOutcome> => {
    const sessionToken = await readSessionToken()
    if (!sessionToken) {
        return { ok: false, reason: "no signed-in session", code: "SESSION_INVALID" }
    }
    const result = await addCartItem(sessionToken, productId, 1)
    if (!result.ok) {
        return { ok: false, reason: result.reason, code: result.code }
    }
    return { ok: true, quantity: result.data.quantity }
}
