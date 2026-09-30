import type { UploadErrorCode } from "@modules/domain/upload"
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

/** One header the client must echo on the content request. */
export interface UploadHeader {
    /** The header name. */
    readonly name: string
    /** The header value. */
    readonly value: string
}

/** The presigned request the client fulfils to store the bytes: the same shape an object store presign answers. */
export interface UploadIntent {
    /** The upload id. */
    readonly uploadId: string
    /** The HTTP method of the content request. */
    readonly method: "PUT"
    /** Where the client sends the bytes. */
    readonly url: string
    /** The headers the client must send; the signed token travels here, never in a cookie. */
    readonly headers: ReadonlyArray<UploadHeader>
    /** When the token stops being valid. */
    readonly expiresAt: Date
}

/** The presigned intent, or the refusal that names why no row was written. */
export type CreateUploadIntentResult = Outcome<UploadIntent, UploadErrorCode>
