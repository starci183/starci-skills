import { StreamableFile } from "@nestjs/common"
import { UploadError } from "@modules/domain/upload"
import type { UploadErrorCode } from "@modules/domain/upload"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { UploadContent, ReadUploadContentResult } from "../../application/read-upload-content.contracts"
import type { UploadSummary } from "../../application/support/upload-summary.contracts"
import type { UploadResponse } from "./dto/upload.response"

/** Maps the outcome of an upload operation to the response, or throws the upload error of a refusal; the instant travels as an ISO string. */
export const toUploadResponse = (outcome: Outcome<UploadSummary, UploadErrorCode>): UploadResponse => {
    const upload = unwrapOutcome(outcome, UploadError)
    return {
        uploadId: upload.uploadId,
        taskId: upload.taskId,
        filename: upload.filename,
        mime: upload.mime,
        sizeBytes: upload.sizeBytes,
        status: upload.status,
        createdAt: upload.createdAt.toISOString(),
    }
}

/** Maps the outcome of a read to the download: the stored media type, the file name (without quotes or line breaks) and the length. */
export const toDownloadFile = (outcome: ReadUploadContentResult): StreamableFile => {
    const upload: UploadContent = unwrapOutcome(outcome, UploadError)
    return new StreamableFile(upload.content, {
        type: upload.mime,
        disposition: `attachment; filename="${upload.filename.replace(/["\r\n]/g, "")}"`,
        length: upload.content.length,
    })
}
