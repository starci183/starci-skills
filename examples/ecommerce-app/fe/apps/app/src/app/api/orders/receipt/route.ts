import { isRecord } from "@ecommerce/api"
import { fetchOrderReceipt, readBody, respond } from "../../../../modules/services"
import { readSessionToken } from "../../../../modules/session"

/**
 * POST `/api/orders/receipt` - ask the order service for a download link of the receipt of one of the person's orders.
 * The link is a presigned URL of the private receipt archive; an anonymous press refuses honestly.
 */
export const POST = async (request: Request): Promise<Response> => {
    const sessionToken = await readSessionToken()
    if (sessionToken === null) return respond({ kind: "refused", code: "SESSION_INVALID" })
    const body = await readBody(request)
    const orderId = isRecord(body) && typeof body.orderId === "string" ? body.orderId : ""
    if (!orderId) return respond({ kind: "invalid", code: "REQUEST_INVALID" })
    return respond(await fetchOrderReceipt(sessionToken, orderId))
}
