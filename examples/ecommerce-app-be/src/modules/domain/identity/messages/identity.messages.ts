import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the identity codes, Vietnamese and English. */
export const IDENTITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.IDENTITY_UNAUTHENTICATED": "Cần đăng nhập để thực hiện thao tác này.",
        "errors.IDENTITY_FORBIDDEN": "Bạn không có quyền thực hiện thao tác này.",
    },
    en: {
        "errors.IDENTITY_UNAUTHENTICATED": "Sign in to do this.",
        "errors.IDENTITY_FORBIDDEN": "You are not allowed to do this.",
    },
}
