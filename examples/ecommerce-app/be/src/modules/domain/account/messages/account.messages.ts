import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the account codes, Vietnamese and English. */
export const ACCOUNT_MESSAGES: MessageBundle = {
    vi: {
        "errors.ACCOUNT_EMAIL_TAKEN": "Email này đã được đăng ký.",
        "errors.ACCOUNT_INVALID_CREDENTIALS": "Email hoặc mật khẩu không đúng.",
        "errors.ACCOUNT_PERSON_UNKNOWN": "Không tìm thấy người dùng.",
    },
    en: {
        "errors.ACCOUNT_EMAIL_TAKEN": "This email is already registered.",
        "errors.ACCOUNT_INVALID_CREDENTIALS": "The email or the password is wrong.",
        "errors.ACCOUNT_PERSON_UNKNOWN": "No such person.",
    },
}
