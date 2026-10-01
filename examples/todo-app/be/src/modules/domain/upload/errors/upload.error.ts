import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the upload capability. */
export enum UploadErrorCode {
    /** The upload does not exist, or the task an upload operation named does not exist. */
    NotFound = "UPLOAD_NOT_FOUND",
    /** The upload, or the task an upload operation named, belongs to somebody else. */
    Forbidden = "UPLOAD_FORBIDDEN",
    /** The size is zero, unreadable or over the ceiling. */
    TooLarge = "UPLOAD_TOO_LARGE",
    /** The media type is not on the allowlist. */
    MimeNotAllowed = "UPLOAD_MIME_NOT_ALLOWED",
    /** The presigned token is missing, malformed, forged, expired or already used. */
    TokenInvalid = "UPLOAD_TOKEN_INVALID",
    /** The upload has no bytes yet, so it cannot be attached or read. */
    NotReady = "UPLOAD_NOT_READY",
    /** The content inspection rejected the bytes. */
    ScanRejected = "UPLOAD_SCAN_REJECTED",
    /** The storage plane could not honour the request. */
    StorageUnavailable = "UPLOAD_STORAGE_UNAVAILABLE",
}

/** How each upload code travels. */
export const UPLOAD_ERROR_KINDS: Record<UploadErrorCode, ErrorKind> = {
    [UploadErrorCode.NotFound]: "not-found",
    [UploadErrorCode.Forbidden]: "forbidden",
    [UploadErrorCode.TooLarge]: "invalid",
    [UploadErrorCode.MimeNotAllowed]: "invalid",
    [UploadErrorCode.TokenInvalid]: "forbidden",
    [UploadErrorCode.NotReady]: "conflict",
    [UploadErrorCode.ScanRejected]: "invalid",
    [UploadErrorCode.StorageUnavailable]: "unavailable",
}

/** The one error class of the upload capability. */
export class UploadError extends DomainError<UploadErrorCode> {}
