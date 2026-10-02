import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the invoice codes, Vietnamese and English. */
export const INVOICE_MESSAGES: MessageBundle = {
    vi: {
        "errors.INVOICE_OVER_LIMIT": "Tổng đơn hàng {{orderId}} vượt hạn mức của một hóa đơn.",
    },
    en: {
        "errors.INVOICE_OVER_LIMIT": "The total of order {{orderId}} is above what one invoice may bill.",
    },
}
