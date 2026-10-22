import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the keycloak codes, Vietnamese and English. */
export const KEYCLOAK_MESSAGES: MessageBundle = {
    vi: {
        "errors.KEYCLOAK_INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
        "errors.KEYCLOAK_PROVIDER_UNAVAILABLE": "Dịch vụ đăng nhập tạm thời không khả dụng.",
    },
    en: {
        "errors.KEYCLOAK_INVALID_CREDENTIALS": "The email or password is incorrect.",
        "errors.KEYCLOAK_PROVIDER_UNAVAILABLE": "The sign-in service is temporarily unavailable.",
    },
}
