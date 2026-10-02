import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the messaging codes, Vietnamese and English. */
export const MESSAGING_MESSAGES: MessageBundle = {
    vi: {
        "errors.MESSAGING_UNAVAILABLE": "Hàng đợi thông điệp tạm thời không khả dụng.",
        "errors.MESSAGING_PAYLOAD_INVALID": "Thông điệp nhận được có nội dung không đúng dạng.",
    },
    en: {
        "errors.MESSAGING_UNAVAILABLE": "The message queue is unavailable.",
        "errors.MESSAGING_PAYLOAD_INVALID": "The received message has a payload of the wrong shape.",
    },
}
