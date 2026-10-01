import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the session codes, Vietnamese and English. */
export const IDENTITY_MESSAGES: MessageBundle = {
    vi: {
        "errors.IDENTITY_SESSION_NOT_FOUND": "Phiên đăng nhập không còn hiệu lực.",
        "errors.IDENTITY_SESSION_EXPIRED": "Phiên đăng nhập đã hết hạn.",
        "errors.IDENTITY_INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
        "errors.IDENTITY_FORBIDDEN": "Bạn không có quyền thực hiện thao tác này.",
        "errors.IDENTITY_PROVIDER_UNAVAILABLE": "Dịch vụ đăng nhập tạm thời không khả dụng.",
    },
    en: {
        "errors.IDENTITY_SESSION_NOT_FOUND": "The session is not active.",
        "errors.IDENTITY_SESSION_EXPIRED": "The session has expired.",
        "errors.IDENTITY_INVALID_CREDENTIALS": "The email or password is incorrect.",
        "errors.IDENTITY_FORBIDDEN": "You are not allowed to do this.",
        "errors.IDENTITY_PROVIDER_UNAVAILABLE": "The sign-in service is temporarily unavailable.",
    },
}
