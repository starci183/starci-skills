import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the upload storage plane. */
export enum UploadStorageErrorCode {
    /** The storage could not honour a put, get or delete, or an object id would leave the storage root. */
    Failed = "UPLOAD_STORAGE_FAILED",
}

/** How each upload storage code travels. */
export const UPLOAD_STORAGE_ERROR_KINDS: Record<UploadStorageErrorCode, ErrorKind> = {
    [UploadStorageErrorCode.Failed]: "unavailable",
}

/** The one error class of the upload storage plane. */
export class UploadStorageError extends DomainError<UploadStorageErrorCode> {}
