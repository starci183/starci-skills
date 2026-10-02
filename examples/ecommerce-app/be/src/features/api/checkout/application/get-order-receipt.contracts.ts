import type { OrderErrorCode } from "@modules/domain/order"
import type { ReceiptLink } from "@modules/integrations/receipt-storage"
import type { Outcome } from "@modules/platform/primitives"

/** Which of the caller's orders the receipt is asked for. */
export interface GetOrderReceiptRequest {
    /** The order. */
    readonly orderId: string
}

/** The receipt link, or why there is none: an order the caller does not have, or a receipt not archived yet. */
export type GetOrderReceiptResult = Outcome<
    ReceiptLink,
    OrderErrorCode.ReceiptNotFound | OrderErrorCode.ReceiptNotReady
>
