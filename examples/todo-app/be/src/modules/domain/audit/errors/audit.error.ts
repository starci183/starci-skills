import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the audit capability, also the refusals of the audit operations. */
export enum AuditErrorCode {
    /** The reader has no verifiable identity to read the log for. */
    OperatorRoleNotAuthorized = "AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED",
    /** The erasure request does not exist. */
    ErasureRequestNotFound = "AUDIT_ERASURE_REQUEST_NOT_FOUND",
    /** The erasure request does not belong to the caller. */
    ErasureRequestForbidden = "AUDIT_ERASURE_REQUEST_FORBIDDEN",
    /** The erasure request is not in a state that allows this step; the state and the expected one ride in the params. */
    ErasureRequestInvalidState = "AUDIT_ERASURE_REQUEST_INVALID_STATE",
    /** The subject stayed readable after the key destruction, so completion is refused. */
    ErasureNotConfirmed = "AUDIT_ERASURE_NOT_CONFIRMED",
}

/** How each audit code travels. */
export const AUDIT_ERROR_KINDS: Record<AuditErrorCode, ErrorKind> = {
    [AuditErrorCode.OperatorRoleNotAuthorized]: "forbidden",
    [AuditErrorCode.ErasureRequestNotFound]: "not-found",
    [AuditErrorCode.ErasureRequestForbidden]: "forbidden",
    [AuditErrorCode.ErasureRequestInvalidState]: "conflict",
    [AuditErrorCode.ErasureNotConfirmed]: "internal",
}

/** The one error class of the audit capability. */
export class AuditError extends DomainError<AuditErrorCode> {}
