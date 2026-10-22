import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the event-bus codes, Vietnamese and English. */
export const EVENT_BUS_MESSAGES: MessageBundle = {
    vi: {
        "errors.EVENT_BUS_BROKER_UNAVAILABLE": "Kênh sự kiện {{operation}} không phản hồi kịp.",
        "errors.EVENT_BUS_DEAD_LETTER_UNKNOWN": "Không có sự kiện lỗi {{id}} để đưa lại.",
    },
    en: {
        "errors.EVENT_BUS_BROKER_UNAVAILABLE": "The event broker did not answer {{operation}} in time.",
        "errors.EVENT_BUS_DEAD_LETTER_UNKNOWN": "There is no dead letter {{id}} to requeue.",
    },
}
