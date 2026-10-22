import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the keycloak admin codes, Vietnamese and English. */
export const KEYCLOAK_ADMIN_MESSAGES: MessageBundle = {
    vi: {
        "errors.KEYCLOAK_ADMIN_EMAIL_TAKEN": "Email này đã được đăng ký.",
        "errors.KEYCLOAK_ADMIN_UNAVAILABLE": "Dịch vụ danh tính hiện không khả dụng.",
    },
    en: {
        "errors.KEYCLOAK_ADMIN_EMAIL_TAKEN": "This email is already registered.",
        "errors.KEYCLOAK_ADMIN_UNAVAILABLE": "The identity provider is unavailable.",
    },
}
