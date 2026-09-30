import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the identity api codes, Vietnamese and English. */
export const IDENTITY_API_MESSAGES: MessageBundle = {
    vi: {
        "errors.IDENTITY_API_UNAVAILABLE": "Dịch vụ danh tính hiện không khả dụng.",
        "errors.IDENTITY_API_CONTRACT_MISMATCH": "Dịch vụ danh tính trả về dữ liệu không đúng hợp đồng.",
    },
    en: {
        "errors.IDENTITY_API_UNAVAILABLE": "The identity service is unavailable.",
        "errors.IDENTITY_API_CONTRACT_MISMATCH": "The identity service answered outside its contract.",
    },
}
