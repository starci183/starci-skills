import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the upload codes, Vietnamese and English. */
export const UPLOAD_MESSAGES: MessageBundle = {
    vi: {
        "errors.UPLOAD_NOT_FOUND": "Không tìm thấy tệp tải lên hoặc công việc.",
        "errors.UPLOAD_FORBIDDEN": "Tệp tải lên hoặc công việc này thuộc về người khác.",
        "errors.UPLOAD_TOO_LARGE": "Tệp phải có kích thước từ 1 đến {{maxBytes}} byte.",
        "errors.UPLOAD_MIME_NOT_ALLOWED": "Loại tệp {{mime}} không được phép.",
        "errors.UPLOAD_TOKEN_INVALID": "Mã tải lên không hợp lệ hoặc đã hết hạn.",
        "errors.UPLOAD_NOT_READY": "Tệp tải lên chưa có nội dung.",
        "errors.UPLOAD_SCAN_REJECTED": "Nội dung tệp bị từ chối sau khi kiểm tra.",
        "errors.UPLOAD_STORAGE_UNAVAILABLE": "Kho lưu trữ tệp tạm thời không khả dụng.",
    },
    en: {
        "errors.UPLOAD_NOT_FOUND": "The upload or the task was not found.",
        "errors.UPLOAD_FORBIDDEN": "The upload or the task belongs to somebody else.",
        "errors.UPLOAD_TOO_LARGE": "The file must be between 1 and {{maxBytes}} bytes.",
        "errors.UPLOAD_MIME_NOT_ALLOWED": "The file type {{mime}} is not allowed.",
        "errors.UPLOAD_TOKEN_INVALID": "The upload token is invalid or has expired.",
        "errors.UPLOAD_NOT_READY": "The upload has no content yet.",
        "errors.UPLOAD_SCAN_REJECTED": "The file content was rejected by the inspection.",
        "errors.UPLOAD_STORAGE_UNAVAILABLE": "The file storage is temporarily unavailable.",
    },
}
