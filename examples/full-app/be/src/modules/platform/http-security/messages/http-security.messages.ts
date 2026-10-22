import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the http-security codes, Vietnamese and English. */
export const HTTP_SECURITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "Nguồn gửi yêu cầu không được phép.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "Bạn gửi quá nhiều yêu cầu, hãy thử lại sau.",
        "errors.HTTP_SECURITY_REQUEST_INVALID": "Dữ liệu gửi lên không hợp lệ: {{fields}}.",
        "errors.HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID": "Chữ ký của webhook không hợp lệ.",
        "errors.HTTP_SECURITY_WEBHOOK_REPLAYED": "Webhook được ký ngoài cửa sổ thời gian cho phép.",
        "errors.HTTP_SECURITY_WEBHOOK_PROVIDER_UNKNOWN": "Nhà cung cấp webhook {{provider}} chưa được cấu hình.",
    },
    en: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "The origin of the request is not allowed.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "Too many requests, try again later.",
        "errors.HTTP_SECURITY_REQUEST_INVALID": "The submitted data is invalid: {{fields}}.",
        "errors.HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID": "The webhook signature is not valid.",
        "errors.HTTP_SECURITY_WEBHOOK_REPLAYED": "The webhook was signed outside the allowed time window.",
        "errors.HTTP_SECURITY_WEBHOOK_PROVIDER_UNKNOWN": "The webhook provider {{provider}} is not configured.",
    },
}
