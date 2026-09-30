import type { UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"

/** What reading the bytes of an upload takes: the upload. */
export interface ReadUploadContentRequest {
    /** The upload; it must be ready and owned by the caller. */
    readonly uploadId: string
}

/** The bytes of an upload with the stored media type and file name. */
export interface UploadContent {
    /** The stored file name. */
    readonly filename: string
    /** The stored media type. */
    readonly mime: string
    /** The bytes. */
    readonly content: Buffer
}

/** The bytes, or the refusal that names why the caller may not read them. */
export type ReadUploadContentResult = Outcome<UploadContent, UploadErrorCode>
