import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the recur codes, Vietnamese and English. */
export const RECUR_MESSAGES: MessageBundle = {
    vi: {
        "errors.RECUR_RULE_INVALID": "Quy tắc lặp không hợp lệ ({{reason}}).",
        "errors.RECUR_RULE_FORBIDDEN": "Quy tắc lặp này thuộc về người khác.",
        "errors.RECUR_RULE_NOT_FOUND": "Không tìm thấy quy tắc lặp.",
        "errors.RECUR_OCCURRENCE_FORBIDDEN": "Bạn không phải chủ sở hữu của lần lặp này.",
        "errors.RECUR_OCCURRENCE_NOT_FOUND": "Không tìm thấy lần lặp.",
    },
    en: {
        "errors.RECUR_RULE_INVALID": "The recurrence rule is invalid ({{reason}}).",
        "errors.RECUR_RULE_FORBIDDEN": "This recurrence rule belongs to somebody else.",
        "errors.RECUR_RULE_NOT_FOUND": "The recurrence rule was not found.",
        "errors.RECUR_OCCURRENCE_FORBIDDEN": "You do not own this occurrence.",
        "errors.RECUR_OCCURRENCE_NOT_FOUND": "The occurrence was not found.",
    },
}
