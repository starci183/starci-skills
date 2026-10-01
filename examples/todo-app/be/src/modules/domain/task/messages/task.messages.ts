import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the task codes, Vietnamese and English. */
export const TASK_MESSAGES: MessageBundle = {
    vi: {
        "errors.TASK_NOT_FOUND": "Không tìm thấy công việc.",
        "errors.TASK_FORBIDDEN": "Bạn không có quyền với công việc này.",
        "errors.TASK_TITLE_REQUIRED": "Tiêu đề công việc không được để trống.",
        "errors.TASK_PLAN_CAP_EXCEEDED":
            "Gói của bạn chỉ cho phép {{cap}} công việc đang mở. Nâng cấp tại {{upgradePath}}.",
    },
    en: {
        "errors.TASK_NOT_FOUND": "The task was not found.",
        "errors.TASK_FORBIDDEN": "You may not touch this task.",
        "errors.TASK_TITLE_REQUIRED": "The task title must not be blank.",
        "errors.TASK_PLAN_CAP_EXCEEDED": "Your plan allows {{cap}} active tasks. Upgrade at {{upgradePath}}.",
    },
}
