import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the jobs codes, Vietnamese and English. */
export const JOBS_MESSAGES: MessageBundle = {
    vi: {
        "errors.JOBS_FENCED_OUT": "Tác vụ {{jobId}} đã được worker khác tiếp nhận; worker này dừng lại.",
        "errors.JOBS_RUN_KEY_INVALID": "Không tạo được khóa chạy cho tác vụ {{jobId}} ở bước {{step}}.",
        "errors.JOBS_CONNECTION_MISSING": "Năng lực tác vụ chưa được khai báo kết nối cơ sở dữ liệu.",
    },
    en: {
        "errors.JOBS_FENCED_OUT": "Job {{jobId}} is owned by a newer worker; this worker stops.",
        "errors.JOBS_RUN_KEY_INVALID": "No run key can be made for job {{jobId}} at step {{step}}.",
        "errors.JOBS_CONNECTION_MISSING": "The jobs capability was registered with no database connection.",
    },
}
