import type { UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"
import type { UploadSummary } from "@modules/domain/upload"

/** What a direct upload takes: the file name, the media type and the bytes. */
export interface CreateDirectUploadRequest {
    /** The file name. */
    readonly filename: string
    /** The media type the request declared. */
    readonly mime: string
    /** The bytes received. */
    readonly content: Buffer
}

/** The upload that is now ready, or the refusal that names why nothing became ready. */
export type CreateDirectUploadResult = Outcome<UploadSummary, UploadErrorCode>
