import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the liveness codes, Vietnamese and English. */
export const LIVENESS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LIVENESS_UNAVAILABLE": "Dịch vụ chưa sẵn sàng; một phụ thuộc bắt buộc không trả lời.",
    },
    en: {
        "errors.LIVENESS_UNAVAILABLE": "The service is not ready; a required dependency did not answer.",
    },
}
