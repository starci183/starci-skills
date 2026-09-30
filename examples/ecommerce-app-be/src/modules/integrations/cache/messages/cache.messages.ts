import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the cache codes, Vietnamese and English. */
export const CACHE_MESSAGES: MessageBundle = {
    vi: {
        "errors.CACHE_UNAVAILABLE": "Kho lưu trữ tạm thời không khả dụng.",
        "errors.CACHE_REPLY_UNREADABLE": "Kho lưu trữ tạm thời trả về dữ liệu không đọc được.",
    },
    en: {
        "errors.CACHE_UNAVAILABLE": "The cache store is unavailable.",
        "errors.CACHE_REPLY_UNREADABLE": "The cache store answered with an unreadable value.",
    },
}
