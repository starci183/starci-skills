import type { UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"
import type { UploadSummary } from "@modules/domain/upload"

/** What attaching an upload takes: the upload and the task. */
export interface AttachUploadRequest {
    /** The upload to attach; it must be ready and owned by the caller. */
    readonly uploadId: string
    /** The task to attach to; it must be owned by the caller. */
    readonly taskId: string
}

/** The attached upload, or the refusal that names why nothing was attached. */
export type AttachUploadResult = Outcome<UploadSummary, UploadErrorCode>
