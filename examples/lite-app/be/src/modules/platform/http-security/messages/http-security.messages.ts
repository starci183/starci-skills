import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the http-security codes, Vietnamese and English. */
export const HTTP_SECURITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "Ngu\u1ed3n g\u1eedi y\u00eau c\u1ea7u kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "B\u1ea1n g\u1eedi qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, h\u00e3y th\u1eed l\u1ea1i sau.",
        "errors.HTTP_SECURITY_REQUEST_INVALID": "D\u1eef li\u1ec7u g\u1eedi l\u00ean kh\u00f4ng h\u1ee3p l\u1ec7: {{fields}}.",
        "errors.HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID": "Ch\u1eef k\u00fd webhook kh\u00f4ng h\u1ee3p l\u1ec7.",
        "errors.HTTP_SECURITY_WEBHOOK_REPLAYED": "Webhook n\u1eb1m ngo\u00e0i c\u1eeda s\u1ed5 th\u1eddi gian cho ph\u00e9p.",
        "errors.HTTP_SECURITY_WEBHOOK_PROVIDER_UNKNOWN": "Nh\u00e0 cung c\u1ea5p webhook {{provider}} ch\u01b0a \u0111\u01b0\u1ee3c c\u1ea5u h\u00ecnh.",
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
