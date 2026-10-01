import "server-only"
import { parseOutcome, requestGraphql, type Outcome } from "@ecommerce/api"
import { ORDER_API_URL } from "../config"
import { toOrderConfirmation, toReceiptLink } from "../order"
import type { OrderConfirmation, ReceiptLink } from "../types"
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

/**
 * A download link of the receipt of one of the person's orders: a presigned URL of the order service's private receipt
 * archive that expires. A receipt the archive has not taken yet answers `invalid` with `ORDER_RECEIPT_NOT_READY`; an order
 * the person does not have answers `not-found`.
 */
export const fetchOrderReceipt = async (sessionToken: string, orderId: string): Promise<Outcome<ReceiptLink>> =>
    parseOutcome(
        await requestGraphql({
            baseUrl: ORDER_API_URL,
            document: DOCUMENTS.ShopOrderReceipt,
            variables: { input: { orderId } },
            token: sessionToken,
        }),
        toReceiptLink,
    )
