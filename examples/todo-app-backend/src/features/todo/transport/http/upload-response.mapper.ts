import type { UploadContent } from "../../application/read-upload-content.contracts"
import type { UploadSummary } from "../../application/support/upload-summary.contracts"
import type { UploadResponse } from "./dto/upload.response"

/** Maps an upload summary to the response; the instant travels as an ISO string. */
export const toUploadResponse = (upload: UploadSummary): UploadResponse => ({
    uploadId: upload.uploadId,
    taskId: upload.taskId,
    filename: upload.filename,
    mime: upload.mime,
    sizeBytes: upload.sizeBytes,
    status: upload.status,
    createdAt: upload.createdAt.toISOString(),
})

/** The headers of a download: the stored media type, the file name (without quotes or line breaks) and the length. */
export const toDownloadHeaders = (upload: UploadContent): Readonly<Record<string, string>> => ({
    "content-type": upload.mime,
    "content-disposition": `attachment; filename="${upload.filename.replace(/["\r\n]/g, "")}"`,
    "content-length": String(upload.content.length),
})
