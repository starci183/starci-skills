import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the SePay codes, Vietnamese and English. */
export const SEPAY_MESSAGES: MessageBundle = {
    vi: {
        "errors.SEPAY_REQUEST_FAILED": "Cổng thanh toán SePay không xử lý được yêu cầu {{operation}} ({{reason}}).",
        "errors.SEPAY_WEBHOOK_UNAUTHORIZED": "Không xác thực được webhook.",
    },
    en: {
        "errors.SEPAY_REQUEST_FAILED": "The SePay {{operation}} request failed ({{reason}}).",
        "errors.SEPAY_WEBHOOK_UNAUTHORIZED": "The webhook could not be authenticated.",
    },
}
