import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the jobs codes, Vietnamese and English. */
export const JOBS_MESSAGES: MessageBundle = {
    vi: {
        "errors.JOBS_FENCED_OUT": "Tác vụ {{jobId}} đã được worker khác tiếp nhận; worker này dừng lại.",
    },
    en: {
        "errors.JOBS_FENCED_OUT": "Job {{jobId}} is owned by a newer worker; this worker stops.",
    },
}
