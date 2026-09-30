import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the errors capability codes, Vietnamese and English. */
export const ERRORS_MESSAGES: MessageBundle = {
    vi: {
        "errors.ERRORS_INTERNAL": "Đã xảy ra lỗi không mong muốn.",
        "errors.ERRORS_OPERATION_INVALID": "Yêu cầu không hợp lệ.",
    },
    en: {
        "errors.ERRORS_INTERNAL": "An unexpected error occurred.",
        "errors.ERRORS_OPERATION_INVALID": "The request is malformed.",
    },
}
