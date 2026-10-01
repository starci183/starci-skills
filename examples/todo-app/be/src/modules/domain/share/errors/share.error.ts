import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the share capability, also the refusals of the share operations. */
export enum ShareErrorCode {
    /** The invitation does not exist. */
    InvitationNotFound = "SHARE_INVITATION_NOT_FOUND",
    /** The caller may not act on this invitation or task. */
    Forbidden = "SHARE_FORBIDDEN",
    /** The address is not well formed. */
    InvalidEmail = "SHARE_INVALID_EMAIL",
    /** The role is neither viewer nor editor. */
    InvalidRole = "SHARE_INVALID_ROLE",
    /** The person already has a pending or accepted invitation on the task. */
    InvitationAlreadyExists = "SHARE_INVITATION_ALREADY_EXISTS",
    /** The invitation was addressed to another email. */
    EmailMismatch = "SHARE_EMAIL_MISMATCH",
    /** The invitation was not accepted inside its window. */
    InvitationExpired = "SHARE_INVITATION_EXPIRED",
    /** The invitation was revoked. */
    InvitationRevoked = "SHARE_INVITATION_REVOKED",
    /** The invitation is already closed: expired, revoked, or accepted by somebody else. */
    InvitationAlreadyClosed = "SHARE_INVITATION_ALREADY_CLOSED",
}

/** How each share code travels. */
export const SHARE_ERROR_KINDS: Record<ShareErrorCode, ErrorKind> = {
    [ShareErrorCode.InvitationNotFound]: "not-found",
    [ShareErrorCode.Forbidden]: "forbidden",
    [ShareErrorCode.InvalidEmail]: "invalid",
    [ShareErrorCode.InvalidRole]: "invalid",
    [ShareErrorCode.InvitationAlreadyExists]: "conflict",
    [ShareErrorCode.EmailMismatch]: "forbidden",
    [ShareErrorCode.InvitationExpired]: "conflict",
    [ShareErrorCode.InvitationRevoked]: "conflict",
    [ShareErrorCode.InvitationAlreadyClosed]: "conflict",
}

/** The one error class of the share capability. */
export class ShareError extends DomainError<ShareErrorCode> {}
