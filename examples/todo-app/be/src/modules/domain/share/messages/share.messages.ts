import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the share codes, Vietnamese and English. */
export const SHARE_MESSAGES: MessageBundle = {
    vi: {
        "errors.SHARE_INVITATION_NOT_FOUND": "Không tìm thấy lời mời.",
        "errors.SHARE_FORBIDDEN": "Lời mời hoặc công việc này thuộc về người khác.",
        "errors.SHARE_INVALID_EMAIL": "Địa chỉ email {{email}} không hợp lệ.",
        "errors.SHARE_INVALID_ROLE": "Vai trò {{role}} không hợp lệ, chỉ có thể là người xem hoặc người chỉnh sửa.",
        "errors.SHARE_INVITATION_ALREADY_EXISTS":
            "{{email}} đã có lời mời đang chờ hoặc đã chấp nhận trên công việc này.",
        "errors.SHARE_EMAIL_MISMATCH": "Lời mời này không được gửi tới email đó.",
        "errors.SHARE_INVITATION_EXPIRED": "Lời mời đã hết hạn.",
        "errors.SHARE_INVITATION_REVOKED": "Lời mời đã bị thu hồi.",
        "errors.SHARE_INVITATION_ALREADY_CLOSED": "Lời mời đã đóng.",
    },
    en: {
        "errors.SHARE_INVITATION_NOT_FOUND": "The invitation was not found.",
        "errors.SHARE_FORBIDDEN": "This invitation or task belongs to somebody else.",
        "errors.SHARE_INVALID_EMAIL": "The email address {{email}} is not well formed.",
        "errors.SHARE_INVALID_ROLE": "The role {{role}} is not valid; it must be viewer or editor.",
        "errors.SHARE_INVITATION_ALREADY_EXISTS":
            "{{email}} already has a pending or accepted invitation on this task.",
        "errors.SHARE_EMAIL_MISMATCH": "This invitation was not addressed to that email.",
        "errors.SHARE_INVITATION_EXPIRED": "This invitation has expired.",
        "errors.SHARE_INVITATION_REVOKED": "This invitation was revoked.",
        "errors.SHARE_INVITATION_ALREADY_CLOSED": "This invitation is already closed.",
    },
}
