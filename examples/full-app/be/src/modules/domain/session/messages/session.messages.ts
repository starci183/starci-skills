import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the session codes, Vietnamese and English. */
export const SESSION_MESSAGES: MessageBundle = {
    vi: { "errors.SESSION_INVALID": "Không có phiên nào còn hiệu lực ứng với mã này." },
    en: { "errors.SESSION_INVALID": "No live session answers this token." },
}
