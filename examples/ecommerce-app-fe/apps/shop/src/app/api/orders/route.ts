import { isRecord } from "@ecommerce/api"
import { placeOrder, readBody, respond } from "../../../modules/services"
import { readSessionToken } from "../../../modules/session"

/**
 * POST `/api/orders` - send the rendered confirmation to the order service's `placeOrder` with its
 * idempotency key. The same key returns the first answer (replayed) rather than a second order; an anonymous
 * press refuses honestly - there is no session to confirm under.
 */
export const POST = async (request: Request): Promise<Response> => {
    const sessionToken = await readSessionToken()
    if (sessionToken === null) return respond({ kind: "refused", code: "SESSION_INVALID" })
    const body = await readBody(request)
    const idempotencyKey = isRecord(body) && typeof body.idempotencyKey === "string" ? body.idempotencyKey : ""
    if (!idempotencyKey) return respond({ kind: "invalid", code: "REQUEST_INVALID" })
    return respond(await placeOrder(sessionToken, idempotencyKey))
}
