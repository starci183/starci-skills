import type { UploadSummary } from "../../application/support/upload-summary.contracts"
import type { UploadType } from "./dto/upload.type"

/** Maps an upload summary to the GraphQL type; the instant travels as an ISO string. */
export const toUploadType = (upload: UploadSummary): UploadType => ({
    uploadId: upload.uploadId,
    taskId: upload.taskId,
    filename: upload.filename,
    mime: upload.mime,
    sizeBytes: upload.sizeBytes,
    status: upload.status,
    createdAt: upload.createdAt.toISOString(),
})
