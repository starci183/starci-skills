import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the order api codes, Vietnamese and English. */
export const ORDER_API_MESSAGES: MessageBundle = {
    vi: {
        "errors.ORDER_API_UNAVAILABLE": "Dịch vụ đơn hàng hiện không khả dụng.",
        "errors.ORDER_API_CONTRACT_MISMATCH": "Dịch vụ đơn hàng trả về dữ liệu không đúng hợp đồng.",
    },
    en: {
        "errors.ORDER_API_UNAVAILABLE": "The order service is unavailable.",
        "errors.ORDER_API_CONTRACT_MISMATCH": "The order service answered outside its contract.",
    },
}
