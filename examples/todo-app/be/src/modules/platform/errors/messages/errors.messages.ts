import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the errors capability codes, Vietnamese and English. */
export const ERRORS_MESSAGES: MessageBundle = {
    vi: {
        "errors.ERRORS_INTERNAL": "Đã xảy ra lỗi không mong muốn.",
        "errors.ERRORS_OPERATION_INVALID": "Yêu cầu không hợp lệ.",
        "errors.ERRORS_ROUTE_NOT_FOUND": "Không tìm thấy đường dẫn được yêu cầu.",
    },
    en: {
        "errors.ERRORS_INTERNAL": "An unexpected error occurred.",
        "errors.ERRORS_OPERATION_INVALID": "The request is malformed.",
        "errors.ERRORS_ROUTE_NOT_FOUND": "No route matches the request.",
    },
}
