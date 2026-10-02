import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the http-security codes, Vietnamese and English. */
export const HTTP_SECURITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "Ngu\u1ed3n g\u1eedi y\u00eau c\u1ea7u kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "B\u1ea1n g\u1eedi qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u, h\u00e3y th\u1eed l\u1ea1i sau.",
    },
    en: {
        "errors.HTTP_SECURITY_ORIGIN_REJECTED": "The origin of the request is not allowed.",
        "errors.HTTP_SECURITY_RATE_LIMITED": "Too many requests, try again later.",
    },
}
