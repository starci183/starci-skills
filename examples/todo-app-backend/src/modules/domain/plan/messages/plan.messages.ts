import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the plan codes, Vietnamese and English. */
export const PLAN_MESSAGES: MessageBundle = {
    vi: {
        "errors.PLAN_FORBIDDEN": "Gói đăng ký này thuộc về người khác.",
        "errors.PLAN_PAYMENT_INTENT_NOT_FOUND": "Không tìm thấy giao dịch thanh toán.",
        "errors.PLAN_SUBSCRIPTION_NOT_FOUND": "Không tìm thấy gói đăng ký.",
    },
    en: {
        "errors.PLAN_FORBIDDEN": "This subscription belongs to somebody else.",
        "errors.PLAN_PAYMENT_INTENT_NOT_FOUND": "The payment intent does not exist.",
        "errors.PLAN_SUBSCRIPTION_NOT_FOUND": "The subscription does not exist.",
    },
}
