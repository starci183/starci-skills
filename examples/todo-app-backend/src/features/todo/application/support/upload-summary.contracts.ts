import type { UploadStatus } from "@modules/domain/upload"

/** An upload as the operations of the upload flow answer it; the owner and the storage key stay inside. */
export interface UploadSummary {
    /** The upload id. */
    readonly uploadId: string
    /** The task the upload is attached to, null while it is unattached. */
    readonly taskId: string | null
    /** The file name. */
    readonly filename: string
    /** The media type. */
    readonly mime: string
    /** The size in bytes. */
    readonly sizeBytes: number
    /** The lifecycle: pending until the bytes land, then ready. */
    readonly status: UploadStatus
    /** When the upload row was created. */
    readonly createdAt: Date
}
