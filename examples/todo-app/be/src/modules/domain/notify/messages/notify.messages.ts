import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the notify codes and of the emails the capability sends, Vietnamese and English. */
export const NOTIFY_MESSAGES: MessageBundle = {
    vi: {
        "errors.NOTIFY_CHANNEL_REQUIRED": "Kênh thông báo không được để trống.",
        "errors.NOTIFY_DIGEST_WINDOW_INVALID": "Khung thời gian tổng hợp phải là số phút nguyên, tối thiểu là 1.",
        "notify.email.task-complete.subject": "Công việc đã hoàn thành: {{taskId}}",
        "notify.email.generic.subject": "Thông báo: {{kind}}",
        "notify.email.digest.subject": "{{count}} cập nhật",
        "notify.email.line": "- {{kind}}: {{payload}}",
    },
    en: {
        "errors.NOTIFY_CHANNEL_REQUIRED": "The notification channel must not be blank.",
        "errors.NOTIFY_DIGEST_WINDOW_INVALID": "The digest window must be a whole number of minutes, at least 1.",
        "notify.email.task-complete.subject": "Task completed: {{taskId}}",
        "notify.email.generic.subject": "Notification: {{kind}}",
        "notify.email.digest.subject": "{{count}} updates",
        "notify.email.line": "- {{kind}}: {{payload}}",
    },
}
