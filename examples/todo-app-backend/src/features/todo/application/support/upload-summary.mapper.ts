import type { UploadView } from "@modules/domain/upload"
import type { UploadSummary } from "./upload-summary.contracts"

/** Maps an upload to what the operations answer: the owner and the storage key are not part of the answer. */
export const toUploadSummary = (upload: UploadView): UploadSummary => ({
    uploadId: upload.id,
    taskId: upload.taskId,
    filename: upload.filename,
    mime: upload.mime,
    sizeBytes: upload.sizeBytes,
    status: upload.status,
    createdAt: upload.createdAt,
})
