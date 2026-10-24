import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the SePay codes, Vietnamese and English. */
export const SEPAY_MESSAGES: MessageBundle = {
    vi: {
        "errors.SEPAY_MALFORMED_RESPONSE": "SePay trả về dữ liệu không đúng hợp đồng.",
    },
    en: {
        "errors.SEPAY_MALFORMED_RESPONSE": "SePay answered outside its contract.",
    },
}
