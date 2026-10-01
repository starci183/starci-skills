import type { DeletedUpload, UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"

/** What deleting an upload takes: its id. */
export interface DeleteUploadRequest {
    /** The upload to delete; it must be owned by the caller. */
    readonly uploadId: string
}

/** The confirmation, or the refusal that names why nothing was deleted. */
export type DeleteUploadResult = Outcome<DeletedUpload, UploadErrorCode>
