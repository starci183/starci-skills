import type { ReceiptLink } from "@modules/integrations/receipt-storage"
import type { GetOrderReceiptRequest } from "../../application/get-order-receipt.contracts"
import type { OrderReceiptInput } from "./dto/order-receipt.input"
import type { OrderReceiptType } from "./dto/order-receipt.type"

/** Maps the GraphQL input to the query request. */
export const toOrderReceiptRequest = (input: OrderReceiptInput): GetOrderReceiptRequest => ({ orderId: input.orderId })

/** Maps the receipt link to the GraphQL type. */
export const toOrderReceiptType = (link: ReceiptLink): OrderReceiptType => ({
    url: link.url,
    expiresAt: link.expiresAt.toISOString(),
})
