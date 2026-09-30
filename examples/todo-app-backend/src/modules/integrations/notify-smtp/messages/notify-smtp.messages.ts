import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the notify-smtp codes, Vietnamese and English. */
export const NOTIFY_SMTP_MESSAGES: MessageBundle = {
    vi: {
        "errors.NOTIFY_SMTP_PERMANENT_REJECTION": "Máy chủ thư đã từ chối vĩnh viễn địa chỉ nhận.",
        "errors.NOTIFY_SMTP_TRANSIENT_FAILURE":
            "Không kết nối được máy chủ thư hoặc máy chủ yêu cầu thử lại: {{reason}}.",
    },
    en: {
        "errors.NOTIFY_SMTP_PERMANENT_REJECTION": "The mail host permanently rejected the recipient address.",
        "errors.NOTIFY_SMTP_TRANSIENT_FAILURE": "The mail host could not be reached or asked for a retry: {{reason}}.",
    },
}
