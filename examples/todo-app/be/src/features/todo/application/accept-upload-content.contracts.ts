import type { UploadErrorCode } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"
import type { UploadSummary } from "@modules/domain/upload"

/** What storing the bytes of an intent takes: the upload, its token and the bytes. */
export interface AcceptUploadContentRequest {
    /** The upload the bytes are for. */
    readonly uploadId: string
    /** The presigned token presented, if any; it is the credential of the door. */
    readonly token: string | undefined
    /** The bytes received. */
    readonly content: Buffer
}

/** The upload that is now ready, or the refusal that names why nothing became ready. */
export type AcceptUploadContentResult = Outcome<UploadSummary, UploadErrorCode>
