/** Names one object of the storage plane; the storage key is derived from the upload id only. */
export interface UploadObjectParams {
    /** The id of the upload the object belongs to. */
    readonly uploadId: string
}

/** What storing an object needs. */
export interface StoreUploadParams {
    /** The id of the upload the object belongs to. */
    readonly uploadId: string
    /** The bytes; storing over an existing object replaces it. */
    readonly content: Buffer
}

/** What inspecting an object needs. */
export interface ScanUploadParams {
    /** The id of the upload the object belongs to. */
    readonly uploadId: string
    /** The bytes that were stored. */
    readonly content: Buffer
}

/** The answer of the content inspection: accepted, or rejected with a reason. */
export type ScanVerdict = { readonly accepted: true } | { readonly accepted: false; readonly reason: string }

/** The answer of reading an object: its bytes, or null when nothing is stored for the upload. */
export type StoredBytesResult = Buffer | null
