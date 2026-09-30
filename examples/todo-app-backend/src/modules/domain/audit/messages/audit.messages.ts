import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the audit codes, Vietnamese and English. */
export const AUDIT_MESSAGES: MessageBundle = {
    vi: {
        "errors.AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED": "Bạn không được phép đọc nhật ký kiểm toán này.",
        "errors.AUDIT_ERASURE_REQUEST_NOT_FOUND": "Không tìm thấy yêu cầu xóa.",
        "errors.AUDIT_ERASURE_REQUEST_FORBIDDEN": "Yêu cầu xóa này không thuộc về bạn.",
        "errors.AUDIT_ERASURE_REQUEST_INVALID_STATE":
            "Yêu cầu xóa đang ở trạng thái {{state}}, cần ở trạng thái {{expected}}.",
        "errors.AUDIT_ERASURE_NOT_CONFIRMED": "Chủ thể vẫn còn đọc được sau khi hủy khóa nên chưa thể hoàn tất.",
    },
    en: {
        "errors.AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED": "You are not allowed to read this audit log.",
        "errors.AUDIT_ERASURE_REQUEST_NOT_FOUND": "The erasure request was not found.",
        "errors.AUDIT_ERASURE_REQUEST_FORBIDDEN": "This erasure request does not belong to you.",
        "errors.AUDIT_ERASURE_REQUEST_INVALID_STATE":
            "The erasure request is in state {{state}} but must be in state {{expected}}.",
        "errors.AUDIT_ERASURE_NOT_CONFIRMED":
            "The subject remains readable after the key destruction, so completion is refused.",
    },
}
