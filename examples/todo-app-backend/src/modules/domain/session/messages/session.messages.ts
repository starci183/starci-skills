import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the session codes, Vietnamese and English. */
export const SESSION_MESSAGES: MessageBundle = {
    vi: {
        "errors.SESSION_NOT_FOUND": "Phiên đăng nhập không còn hiệu lực.",
        "errors.SESSION_EXPIRED": "Phiên đăng nhập đã hết hạn.",
        "errors.SESSION_INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
        "errors.SESSION_FORBIDDEN": "Bạn không có quyền thực hiện thao tác này.",
        "errors.SESSION_PROVIDER_UNAVAILABLE": "Dịch vụ đăng nhập tạm thời không khả dụng.",
    },
    en: {
        "errors.SESSION_NOT_FOUND": "The session is not active.",
        "errors.SESSION_EXPIRED": "The session has expired.",
        "errors.SESSION_INVALID_CREDENTIALS": "The email or password is incorrect.",
        "errors.SESSION_FORBIDDEN": "You are not allowed to do this.",
        "errors.SESSION_PROVIDER_UNAVAILABLE": "The sign-in service is temporarily unavailable.",
    },
}
