import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the http-security codes, Vietnamese and English. */
export const HTTP_SECURITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "Nguồn gửi yêu cầu không được phép.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "Bạn gửi quá nhiều yêu cầu, hãy thử lại sau.",
    },
    en: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "The origin of the request is not allowed.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "Too many requests, try again later.",
    },
}
