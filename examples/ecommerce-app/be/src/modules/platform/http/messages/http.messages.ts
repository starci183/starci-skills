import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the http capability codes, Vietnamese and English. */
export const HTTP_MESSAGES: MessageBundle = {
    vi: {
        "errors.HTTP_TIMEOUT": "Dịch vụ phụ thuộc không phản hồi kịp thời.",
        "errors.HTTP_NETWORK": "Không thể kết nối tới dịch vụ phụ thuộc.",
        "errors.HTTP_BODY_UNREADABLE": "Dịch vụ phụ thuộc trả về dữ liệu không đọc được.",
    },
    en: {
        "errors.HTTP_TIMEOUT": "A dependent service did not answer in time.",
        "errors.HTTP_NETWORK": "A dependent service could not be reached.",
        "errors.HTTP_BODY_UNREADABLE": "A dependent service answered with an unreadable body.",
    },
}
