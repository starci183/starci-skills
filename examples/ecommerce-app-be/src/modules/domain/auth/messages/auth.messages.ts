import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the auth codes, Vietnamese and English. */
export const AUTH_MESSAGES: MessageBundle = {
    vi: {
        "errors.AUTH_UNAUTHENTICATED": "Cần đăng nhập để thực hiện thao tác này.",
        "errors.AUTH_FORBIDDEN": "Bạn không có quyền thực hiện thao tác này.",
    },
    en: {
        "errors.AUTH_UNAUTHENTICATED": "Sign in to do this.",
        "errors.AUTH_FORBIDDEN": "You are not allowed to do this.",
    },
}
