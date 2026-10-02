import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the event-bus codes, Vietnamese and English. */
export const EVENT_BUS_MESSAGES: MessageBundle = {
    vi: {
        "errors.EVENT_BUS_ENVELOPE_INVALID": "Sự kiện {{event}} nhận được có nội dung không đúng dạng.",
    },
    en: {
        "errors.EVENT_BUS_ENVELOPE_INVALID": "The received {{event}} event has a payload of the wrong shape.",
    },
}
