import type { UploadContent, UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"

/** What reading the bytes of an upload takes: the upload. */
export interface ReadUploadContentRequest {
    /** The upload; it must be ready and owned by the caller. */
    readonly uploadId: string
}

/** The bytes, or the refusal that names why the caller may not read them. */
export type ReadUploadContentResult = Outcome<UploadContent, UploadErrorCode>
