import { isRecord } from "@ecommerce/api"
import { addCartItem, readBody, respond } from "../../../../modules/services"
import { readSessionToken } from "../../../../modules/session"

/**
 * POST `/api/cart/items` - add one of a product to the signed-in person's server-side cart. An anonymous press
 * refuses honestly - there is no client-side cart to pretend with - and a refused session surfaces the same
 * `SESSION_INVALID` the order service answered. The answer is the line's new quantity.
 */
export const POST = async (request: Request): Promise<Response> => {
    const sessionToken = await readSessionToken()
    if (sessionToken === null) return respond({ kind: "refused", code: "SESSION_INVALID" })
    const body = await readBody(request)
    const productId = isRecord(body) && typeof body.productId === "string" ? body.productId : ""
    if (!productId) return respond({ kind: "invalid", code: "REQUEST_INVALID" })
    return respond(await addCartItem(sessionToken, productId, 1))
}
