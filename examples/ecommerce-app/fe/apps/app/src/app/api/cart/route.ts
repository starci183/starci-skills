import { clearCart, respond } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"

/**
 * DELETE `/api/cart` - empty the signed-in person's server-side cart: the only removal the order service
 * exposes, so this is what "remove" means on the cart surface. An anonymous press refuses honestly.
 */
export const DELETE = async (): Promise<Response> => {
    const sessionToken = await readSessionToken()
    if (sessionToken === null) return respond({ kind: "refused", code: "SESSION_INVALID" })
    return respond(await clearCart(sessionToken))
}
