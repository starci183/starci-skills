import type { UploadErrorCode, UploadIntent } from "@modules/domain/upload"
import type { Outcome } from "@modules/platform/primitives"

/** What opening an upload intent takes: the declared shape of the file. */
export interface CreateUploadIntentRequest {
    /** The file name. */
    readonly filename: string
    /** The declared media type. */
    readonly mime: string
    /** The declared size in bytes. */
    readonly sizeBytes: number
}

/** The presigned intent, or the refusal that names why no row was written. */
export type CreateUploadIntentResult = Outcome<UploadIntent, UploadErrorCode>
